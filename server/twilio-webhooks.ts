import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  isBusinessHours,
  getLadderSteps,
  getRingDuration,
  resolveUserForStep,
  createIncident,
  logIncidentEvent,
} from "./routing-engine";
import { getDb } from "./db";
import { callAttempts, users, incidents } from "../drizzle/schema";
import { eq, and, notInArray } from "drizzle-orm";

const router = Router();

// ============================================================================
// Twilio Webhook Security
// ============================================================================

/**
 * Verify Twilio webhook signature
 * 
 * Twilio signs all webhook requests with X-Twilio-Signature header.
 * This middleware verifies the signature to ensure requests are from Twilio.
 * 
 * Fallback: If TWILIO_AUTH_TOKEN is not set, use shared secret in Authorization header.
 */
function verifyTwilioSignature(req: Request, res: Response, next: NextFunction) {
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  // Method 1: Twilio signature verification (preferred)
  if (twilioAuthToken) {
    const twilioSignature = req.headers["x-twilio-signature"] as string;
    
    if (!twilioSignature) {
      console.error("[Twilio Webhook] Missing X-Twilio-Signature header");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Construct the full URL (Twilio needs this for signature validation)
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const url = `${protocol}://${host}${req.originalUrl}`;
    
    // Compute expected signature
    const params = req.body;
    const data = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], url);
    
    const expectedSignature = crypto
      .createHmac("sha1", twilioAuthToken)
      .update(Buffer.from(data, "utf-8"))
      .digest("base64");
    
    if (twilioSignature !== expectedSignature) {
      console.error("[Twilio Webhook] Invalid signature");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    console.log("[Twilio Webhook] Signature verified");
    return next();
  }
  
  // Method 2: Shared secret fallback
  if (webhookSecret) {
    const authHeader = req.headers["authorization"];
    
    if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
      console.error("[Twilio Webhook] Invalid or missing authorization header");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    console.log("[Twilio Webhook] Shared secret verified");
    return next();
  }
  
  // No security configured - reject in production
  if (process.env.NODE_ENV === "production") {
    console.error("[Twilio Webhook] No security configured in production");
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  // Allow in development
  console.warn("[Twilio Webhook] No security configured - allowing in development");
  next();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get users for a ladder step, excluding unavailable and already-rung users
 */
async function getUsersForStep(
  step: string,
  attemptedUserIds: number[]
): Promise<Array<{ id: number; phone: string; name: string }>> {
  const db = await getDb();
  if (!db) return [];
  
  // Resolve user IDs for this step
  const userIds = await resolveUserForStep(step, attemptedUserIds);
  
  if (userIds.length === 0) {
    return [];
  }
  
  // Fetch user details, excluding unavailable users
  const result: any = await db
    .select({
      id: users.id,
      phone: users.phone,
      name: users.name,
    })
    .from(users)
    .where(
      and(
        eq(users.available, true),
        eq(users.active, true),
        userIds.length > 0 ? notInArray(users.id, attemptedUserIds) : undefined
      )
    );
  
  return result.filter((u: any) => u.phone); // Only return users with phone numbers
}

/**
 * Log a call attempt to the database
 */
async function logCallAttempt(
  incidentId: number,
  userId: number,
  stepNumber: number,
  result: "ringing" | "answered" | "missed" | "declined" | "timeout"
) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(callAttempts).values({
    incidentId,
    targetUserId: userId,
    step: stepNumber,
    result,
    startedAt: new Date(),
  });
}

// ============================================================================
// Twilio Studio Flow Endpoints
// ============================================================================

/**
 * POST /api/telephony/next-target
 * 
 * Returns the next phone number to call in the routing ladder.
 * 
 * Request body:
 * - incidentId: number (optional - will create if not provided)
 * - callerPhone: string (E.164 format, e.g., +14155551234)
 * - callSid: string (Twilio Call SID)
 * 
 * Response:
 * - incidentId: number
 * - nextPhoneE164: string | null
 * - stepName: string
 * - timeoutSeconds: number (30)
 * - userName: string (for logging)
 */
router.post("/telephony/next-target", verifyTwilioSignature, async (req, res) => {
  try {
    const { incidentId: existingIncidentId, callerPhone, callSid, buildingId } = req.body;
    
    console.log("[Twilio] next-target request:", { existingIncidentId, callerPhone, callSid, buildingId });
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }
    
    let incidentId = existingIncidentId;
    
    // Create incident if not provided
    if (!incidentId) {
      incidentId = await createIncident({
        callerId: callerPhone || "unknown",
        siteId: undefined, // Will be matched by routing engine
        buildingId: buildingId || undefined, // From Twilio call metadata
      });
      console.log("[Twilio] Created incident:", incidentId);
    }
    
    // Get already-attempted user IDs for this incident
    const attemptedResult: any = await db
      .select({ userId: callAttempts.targetUserId })
      .from(callAttempts)
      .where(eq(callAttempts.incidentId, incidentId));
    
    const attemptedUserIds = attemptedResult.map((r: any) => r.userId);
    
    // Determine business hours and ladder
    const isBH = await isBusinessHours();
    const ladder = await getLadderSteps(isBH);
    const ringDuration = await getRingDuration();
    
    console.log("[Twilio] Routing context:", {
      incidentId,
      isBusinessHours: isBH,
      ladder,
      attemptedUserIds,
    });
    
    // Try each ladder step until we find an available user
    for (let stepIndex = 0; stepIndex < ladder.length; stepIndex++) {
      const step = ladder[stepIndex];
      const availableUsers = await getUsersForStep(step, attemptedUserIds);
      
      if (availableUsers.length > 0) {
        const nextUser = availableUsers[0]; // Take first available user
        
        // Log this attempt as "ringing"
        await logCallAttempt(incidentId, nextUser.id, stepIndex, "ringing");
        
        console.log("[Twilio] Next target:", {
          incidentId,
          userId: nextUser.id,
          phone: nextUser.phone,
          stepName: step,
        });
        
        return res.json({
          incidentId,
          nextPhoneE164: nextUser.phone,
          stepName: step,
          timeoutSeconds: ringDuration,
          userName: nextUser.name || "Unknown",
        });
      }
    }
    
    // No more users to try
    console.log("[Twilio] No more targets available for incident:", incidentId);
    
    await logIncidentEvent({
      incidentId,
      type: "routing_exhausted",
      payloadJson: { message: "All routing steps exhausted, no answer" },
    });
    
    return res.json({
      incidentId,
      nextPhoneE164: null,
      stepName: "exhausted",
      timeoutSeconds: 0,
      userName: null,
    });
  } catch (error: any) {
    console.error("[Twilio] next-target error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/telephony/answered
 * 
 * Called when a technician answers the call.
 * 
 * Request body:
 * - incidentId: number
 * - answeredPhone: string (E.164 format)
 * - callSid: string (Twilio Call SID)
 * 
 * Response:
 * - success: boolean
 */
router.post("/telephony/answered", verifyTwilioSignature, async (req, res) => {
  try {
    const { incidentId, answeredPhone, callSid } = req.body;
    
    console.log("[Twilio] answered:", { incidentId, answeredPhone, callSid });
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }
    
    // Find user by phone
    const userResult: any = await db
      .select()
      .from(users)
      .where(eq(users.phone, answeredPhone))
      .limit(1);
    
    if (!userResult || userResult.length === 0) {
      console.error("[Twilio] User not found for phone:", answeredPhone);
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userResult[0];
    
    // Update the most recent call attempt to "answered"
    const attemptResult: any = await db
      .select()
      .from(callAttempts)
      .where(
        and(
          eq(callAttempts.incidentId, incidentId),
          eq(callAttempts.targetUserId, user.id),
          eq(callAttempts.result, "ringing")
        )
      )
      .limit(1);
    
    if (attemptResult && attemptResult.length > 0) {
      await db
        .update(callAttempts)
        .set({
          result: "answered",
          endedAt: new Date(),
        })
        .where(eq(callAttempts.id, attemptResult[0].id));
    }
    
    // Update incident status to "en_route"
    await db
      .update(incidents)
      .set({
        assignedUserId: user.id,
        status: "en_route",
      })
      .where(eq(incidents.id, incidentId));
    
    // Log event
    await logIncidentEvent({
      incidentId,
      type: "call_answered",
      userId: user.id,
      payloadJson: {
        userName: user.name,
        phone: answeredPhone,
      },
    });
    
    console.log("[Twilio] Call answered by:", user.name);
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Twilio] answered error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/telephony/completed
 * 
 * Called when the call ends.
 * 
 * Request body:
 * - incidentId: number
 * - callSid: string (Twilio Call SID)
 * - duration: number (call duration in seconds)
 * 
 * Response:
 * - success: boolean
 */
router.post("/telephony/completed", verifyTwilioSignature, async (req, res) => {
  try {
    const { incidentId, callSid, duration } = req.body;
    
    console.log("[Twilio] completed:", { incidentId, callSid, duration });
    
    // Log event
    await logIncidentEvent({
      incidentId,
      type: "call_completed",
      payloadJson: {
        callSid,
        duration,
      },
    });
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Twilio] completed error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/telephony/attempt-failed
 * 
 * Called when a call attempt fails (no answer, busy, failed).
 * 
 * Request body:
 * - incidentId: number
 * - targetPhone: string (E.164 format)
 * - reason: string ("no-answer" | "busy" | "failed")
 * - callSid: string (Twilio Call SID)
 * 
 * Response:
 * - success: boolean
 */
router.post("/telephony/attempt-failed", verifyTwilioSignature, async (req, res) => {
  try {
    const { incidentId, targetPhone, reason, callSid } = req.body;
    
    console.log("[Twilio] attempt-failed:", { incidentId, targetPhone, reason, callSid });
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }
    
    // Find user by phone
    const userResult: any = await db
      .select()
      .from(users)
      .where(eq(users.phone, targetPhone))
      .limit(1);
    
    if (userResult && userResult.length > 0) {
      const user = userResult[0];
      
      // Update the most recent ringing attempt to failed status
      const attemptResult: any = await db
        .select()
        .from(callAttempts)
        .where(
          and(
            eq(callAttempts.incidentId, incidentId),
            eq(callAttempts.targetUserId, user.id),
            eq(callAttempts.result, "ringing")
          )
        )
        .limit(1);
      
      if (attemptResult && attemptResult.length > 0) {
        const result = reason === "no-answer" ? "missed" : reason === "busy" ? "timeout" : "timeout";
        
        await db
          .update(callAttempts)
          .set({ 
            result,
            endedAt: new Date(),
          })
          .where(eq(callAttempts.id, attemptResult[0].id));
      }
      
      // Log event
      await logIncidentEvent({
        incidentId,
        type: "call_attempt_failed",
        userId: user.id,
        payloadJson: {
          userName: user.name,
          phone: targetPhone,
          reason,
        },
      });
    }
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Twilio] attempt-failed error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
