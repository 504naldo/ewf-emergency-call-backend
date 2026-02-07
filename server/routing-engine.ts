import { getDb } from "./db";
import {
  incidents,
  callAttempts,
  incidentEvents,
  users,
  oncallSchedule,
  rotationState,
  systemConfig,
  type InsertIncident,
  type InsertCallAttempt,
  type InsertIncidentEvent,
} from "../drizzle/schema";
import { eq, and, lte, gte, inArray } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type BusinessHoursConfig = {
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: string;
};

export type LadderConfig = {
  steps: string[]; // e.g., ["primary_oncall", "secondary", "admin", "manager", "rotating_pool"]
};

export type RoutingContext = {
  incidentId: number;
  isBusinessHours: boolean;
  currentStep: number;
  attemptedUserIds: number[];
};

// ============================================================================
// Business Hours Detection
// ============================================================================

export async function isBusinessHours(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const configResult: any = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "business_hours"))
    .limit(1);

  if (!configResult || configResult.length === 0) {
    // Default to business hours if no config
    return true;
  }

  const config: BusinessHoursConfig = configResult[0].value;
  const now = new Date();

  // Get current time in configured timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dayOfWeek = now.getDay();
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");

  // Check if current day is in business days
  if (!config.days.includes(dayOfWeek)) {
    return false;
  }

  // Check if current time is within business hours
  const currentMinutes = hour * 60 + minute;
  const startMinutes = config.startHour * 60 + config.startMinute;
  const endMinutes = config.endHour * 60 + config.endMinute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ============================================================================
// Ladder Routing
// ============================================================================

export async function getLadderSteps(isBusinessHours: boolean): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const key = isBusinessHours ? "business_hours_ladder" : "after_hours_ladder";
  const configResult: any = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);

  if (!configResult || configResult.length === 0) {
    // Default ladders
    return isBusinessHours
      ? ["primary_oncall", "secondary", "admin", "manager", "broadcast"]
      : ["primary_oncall", "secondary", "manager", "admin", "rotating_pool"];
  }

  const config: LadderConfig = configResult[0].value;
  return config.steps;
}

export async function getRingDuration(): Promise<number> {
  const db = await getDb();
  if (!db) return 30; // Default 30 seconds

  const configResult: any = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "ring_duration"))
    .limit(1);

  if (!configResult || configResult.length === 0) {
    return 30;
  }

  return configResult[0].value.seconds || 30;
}

// ============================================================================
// User Resolution
// ============================================================================

export async function resolveUserForStep(
  step: string,
  attemptedUserIds: number[]
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  switch (step) {
    case "primary_oncall": {
      const result: any = await db
        .select({ userId: oncallSchedule.userId })
        .from(oncallSchedule)
        .where(
          and(
            eq(oncallSchedule.isPrimary, true),
            lte(oncallSchedule.startTime, now),
            gte(oncallSchedule.endTime, now)
          )
        )
        .limit(1);
      return result.length > 0 ? [result[0].userId] : [];
    }

    case "secondary": {
      const result: any = await db
        .select({ userId: oncallSchedule.userId })
        .from(oncallSchedule)
        .where(
          and(
            eq(oncallSchedule.isSecondary, true),
            lte(oncallSchedule.startTime, now),
            gte(oncallSchedule.endTime, now)
          )
        )
        .limit(1);
      return result.length > 0 ? [result[0].userId] : [];
    }

    case "admin": {
      const result: any = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true)))
        .limit(1);
      return result.length > 0 ? [result[0].id] : [];
    }

    case "manager": {
      const result: any = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "manager"),
            eq(users.active, true)
          )
        );
      return result.map((r: any) => r.id);
    }

    case "broadcast":
    case "admin": {
      const result: any = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            inArray(users.role, ["admin", "manager"]),
            eq(users.active, true)
          )
        );
      return result.map((r: any) => r.id);
    }
    
    case "rotating_pool": {
      return await getNextRotatingUsers(attemptedUserIds);
    }

    default:
      return [];
  }
}

async function getNextRotatingUsers(
  attemptedUserIds: number[]
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  // Get all eligible users from the pool
  const eligibleResult: any = await db
    .select({ userId: oncallSchedule.userId })
    .from(oncallSchedule)
    .where(
      and(
        eq(oncallSchedule.eligiblePool, true),
        lte(oncallSchedule.startTime, now),
        gte(oncallSchedule.endTime, now)
      )
    );

  const eligibleUserIds = eligibleResult.map((r: any) => r.userId);

  // Filter out already attempted users
  const availableUserIds = eligibleUserIds.filter(
    (id: number) => !attemptedUserIds.includes(id)
  );

  if (availableUserIds.length === 0) {
    return [];
  }

  // Get current rotation state
  const rotationResult: any = await db
    .select()
    .from(rotationState)
    .limit(1);

  let pointerIndex = 0;
  let rotationId = 1;

  if (rotationResult && rotationResult.length > 0) {
    pointerIndex = rotationResult[0].pointerIndex || 0;
    rotationId = rotationResult[0].id;
  }

  // Get next 3 users from rotation, wrapping around if needed
  const next3Users: number[] = [];
  for (let i = 0; i < 3 && next3Users.length < availableUserIds.length; i++) {
    const index = (pointerIndex + i) % availableUserIds.length;
    next3Users.push(availableUserIds[index]);
  }

  // Update rotation pointer
  const newPointerIndex = (pointerIndex + 3) % availableUserIds.length;
  await db
    .update(rotationState)
    .set({
      pointerIndex: newPointerIndex,
      lastUsedUserIds: next3Users,
    })
    .where(eq(rotationState.id, rotationId));

  return next3Users;
}

// ============================================================================
// Incident Creation
// ============================================================================

export async function createIncident(data: {
  externalId?: string;
  callerId?: string;
  siteId?: number;
  buildingId?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const isBH = await isBusinessHours();

  const incidentData: InsertIncident = {
    externalId: data.externalId,
    bhAh: isBH ? "business_hours" : "after_hours",
    callerId: data.callerId,
    siteId: data.siteId,
    buildingId: data.buildingId,
    status: "open",
  };

  const result: any = await db.insert(incidents).values(incidentData);
  
  // Drizzle ORM returns different result structures depending on the driver
  // For mysql2, the result is an array where the first element has insertId
  const incidentId = Array.isArray(result) ? result[0]?.insertId : result.insertId;
  
  if (!incidentId) {
    throw new Error("Failed to get incident ID from insert result");
  }

  // Log incident creation event
  await logIncidentEvent({
    incidentId,
    type: "incident_created",
    payloadJson: { ...incidentData, isBusinessHours: isBH },
  });

  return incidentId;
}

// ============================================================================
// Call Attempt Logging
// ============================================================================

export async function logCallAttempt(data: {
  incidentId: number;
  step: number;
  targetUserId: number;
  result?: "ringing" | "answered" | "missed" | "declined" | "timeout";
  declineReason?: "busy" | "already_on_call" | "out_of_area" | "other";
  declineReasonText?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const attemptData: InsertCallAttempt = {
    incidentId: data.incidentId,
    step: data.step,
    targetUserId: data.targetUserId,
    startedAt: new Date(),
    endedAt: data.result ? new Date() : undefined,
    result: data.result,
    declineReason: data.declineReason,
    declineReasonText: data.declineReasonText,
  };

  const result: any = await db.insert(callAttempts).values(attemptData);
  return result.insertId;
}

export async function updateCallAttempt(
  attemptId: number,
  data: {
    result: "ringing" | "answered" | "missed" | "declined" | "timeout";
    declineReason?: "busy" | "already_on_call" | "out_of_area" | "other";
    declineReasonText?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(callAttempts)
    .set({
      endedAt: new Date(),
      result: data.result,
      declineReason: data.declineReason,
      declineReasonText: data.declineReasonText,
    })
    .where(eq(callAttempts.id, attemptId));
}

// ============================================================================
// Incident Event Logging
// ============================================================================

export async function logIncidentEvent(data: InsertIncidentEvent): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(incidentEvents).values(data);
}

// ============================================================================
// Main Routing Logic
// ============================================================================

export async function startRouting(incidentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get incident details
  const incidentResult: any = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incidentResult || incidentResult.length === 0) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const incident = incidentResult[0];
  const isBH = incident.bhAh === "business_hours";

  // Get ladder steps
  const steps = await getLadderSteps(isBH);

  // Start routing through ladder
  const context: RoutingContext = {
    incidentId,
    isBusinessHours: isBH,
    currentStep: 0,
    attemptedUserIds: [],
  };

  await routeToNextStep(context, steps);
}

async function routeToNextStep(
  context: RoutingContext,
  steps: string[]
): Promise<void> {
  if (context.currentStep >= steps.length) {
    // End of ladder reached, no one answered
    await handleUnansweredEmergency(context.incidentId);
    return;
  }

  const stepName = steps[context.currentStep];
  const userIds = await resolveUserForStep(stepName, context.attemptedUserIds);

  if (userIds.length === 0) {
    // No users available for this step, move to next
    context.currentStep++;
    await routeToNextStep(context, steps);
    return;
  }

  // For broadcast or rotating pool, call all users simultaneously
  if (stepName === "broadcast" || stepName === "rotating_pool") {
    for (const userId of userIds) {
      await initiateCall(context.incidentId, context.currentStep, userId);
      context.attemptedUserIds.push(userId);
    }
  } else {
    // For single user steps, call one at a time
    const userId = userIds[0];
    await initiateCall(context.incidentId, context.currentStep, userId);
    context.attemptedUserIds.push(userId);
  }

  // Note: In a real implementation, this would wait for the call result
  // and then decide whether to move to the next step. For now, this is
  // a placeholder that would be triggered by webhook events.
}

async function initiateCall(
  incidentId: number,
  step: number,
  userId: number
): Promise<void> {
  // Log call attempt
  await logCallAttempt({
    incidentId,
    step,
    targetUserId: userId,
    result: "ringing",
  });

  // Log event
  await logIncidentEvent({
    incidentId,
    type: "call_initiated",
    userId,
    payloadJson: { step, userId },
  });

  // In a real implementation, this would trigger the telephony provider
  // to make the actual phone call. For now, this is a placeholder.
  console.log(`[Routing] Initiating call to user ${userId} for incident ${incidentId}`);
}

async function handleUnansweredEmergency(incidentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Mark incident as critical
  await db
    .update(incidents)
    .set({ critical: true })
    .where(eq(incidents.id, incidentId));

  // Log event
  await logIncidentEvent({
    incidentId,
    type: "unanswered_emergency",
    payloadJson: { message: "Emergency call went unanswered through entire ladder" },
  });

  // Send broadcast alert to all admins and managers
  // This would trigger push notifications in a real implementation
  console.log(`[Routing] UNANSWERED EMERGENCY for incident ${incidentId}`);
}

// ============================================================================
// Incident Assignment
// ============================================================================

export async function assignIncident(
  incidentId: number,
  userId: number,
  assignedBy?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(incidents)
    .set({
      assignedUserId: userId,
      status: "open",
    })
    .where(eq(incidents.id, incidentId));

  await logIncidentEvent({
    incidentId,
    type: "incident_assigned",
    userId: assignedBy,
    payloadJson: { assignedUserId: userId, assignedBy },
  });
}

export async function handleAnsweredUnclaimed(incidentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(incidents)
    .set({ answeredUnclaimed: true })
    .where(eq(incidents.id, incidentId));

  await logIncidentEvent({
    incidentId,
    type: "answered_unclaimed",
    payloadJson: {
      message: "Call was answered but not claimed within 90 seconds",
    },
  });

  console.log(`[Routing] Incident ${incidentId} answered but unclaimed`);
}
