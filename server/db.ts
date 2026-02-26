import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as schema from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Incidents
// ============================================================================

import {
  incidents,
  callAttempts,
  incidentEvents,
  sites,
  systemConfig,
  type Incident,
  type CallAttempt,
  type IncidentEvent,
  type Site,
} from "../drizzle/schema";
import { desc, and, inArray, isNull } from "drizzle-orm";

export async function getIncidentById(id: number): Promise<Incident | null> {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getIncidentsByStatus(
  status: Incident["status"]
): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(incidents)
    .where(eq(incidents.status, status))
    .orderBy(desc(incidents.createdAt));

  return result;
}

export async function getIncidentsByUser(userId: number): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(incidents)
    .where(eq(incidents.assignedUserId, userId))
    .orderBy(desc(incidents.createdAt));

  return result;
}

export async function getAllOpenIncidents(): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(incidents)
    .where(
      inArray(incidents.status, ["open", "en_route", "on_site"])
    )
    .orderBy(desc(incidents.createdAt));

  return result;
}

export async function getUnclaimedIncidents(): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.status, "open"),
        isNull(incidents.assignedUserId)
      )
    )
    .orderBy(desc(incidents.createdAt));

  return result;
}

export async function updateIncidentStatus(
  id: number,
  status: Incident["status"],
  userId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  
  if (status === "resolved") {
    updateData.resolvedAt = new Date();
  }

  await db
    .update(incidents)
    .set(updateData)
    .where(eq(incidents.id, id));

  // Log status change event
  await db.insert(incidentEvents).values({
    incidentId: id,
    type: "status_changed",
    userId,
    payloadJson: { newStatus: status },
  });
}

export async function closeIncident(
  id: number,
  data: {
    outcome: Incident["outcome"];
    outcomeNotes?: string;
    followUpRequired: boolean;
  },
  userId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(incidents)
    .set({
      status: data.followUpRequired ? "follow_up_required" : "resolved",
      outcome: data.outcome,
      outcomeNotes: data.outcomeNotes,
      followUpRequired: data.followUpRequired,
      resolvedAt: new Date(),
    })
    .where(eq(incidents.id, id));

  // Log close event
  await db.insert(incidentEvents).values({
    incidentId: id,
    type: "incident_closed",
    userId,
    payloadJson: data,
  });
}

// ============================================================================
// Call Attempts
// ============================================================================

export async function getCallAttemptsByIncident(
  incidentId: number
): Promise<CallAttempt[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.incidentId, incidentId))
    .orderBy(callAttempts.startedAt);

  return result;
}

// ============================================================================
// Incident Events
// ============================================================================

export async function getIncidentEvents(
  incidentId: number
): Promise<IncidentEvent[]> {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(incidentEvents)
    .where(eq(incidentEvents.incidentId, incidentId))
    .orderBy(incidentEvents.at);

  return result;
}

// ============================================================================
// Users
// ============================================================================

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getUsersByRole(role: "tech" | "admin" | "manager") {
  const db = await getDb();
  if (!db) return [];

  const result: any = await db
    .select()
    .from(users)
    .where(and(eq(users.role, role), eq(users.active, true)));

  return result;
}

export async function updateUserAvailability(
  userId: number,
  available: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ available })
    .where(eq(users.id, userId));
}

// ============================================================================
// Sites
// ============================================================================

export async function getSiteById(id: number): Promise<Site | null> {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function matchSiteByPhone(phone: string): Promise<Site | null> {
  const db = await getDb();
  if (!db) return null;

  // Get all sites with phone match rules
  const result: any = await db.select().from(sites);

  for (const site of result) {
    if (site.phoneMatchRules && Array.isArray(site.phoneMatchRules)) {
      for (const pattern of site.phoneMatchRules) {
        if (phone.includes(pattern) || pattern.includes(phone)) {
          return site;
        }
      }
    }
  }

  return null;
}

// ============================================================================
// System Configuration
// ============================================================================

export async function getSystemConfig(key: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  const result: any = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);

  return result.length > 0 ? result[0].value : null;
}

export async function setSystemConfig(key: string, value: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if config exists
  const existing: any = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(systemConfig)
      .set({ value })
      .where(eq(systemConfig.key, key));
  } else {
    // Insert new
    await db.insert(systemConfig).values({ key, value });
  }
}
