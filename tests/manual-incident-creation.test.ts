import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../server/db";
import { createIncident } from "../server/routing-engine";
import { incidents, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Manual Incident Creation", () => {
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get admin user for testing
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (adminUsers.length === 0) {
      throw new Error("No admin user found for testing");
    }

    testUserId = adminUsers[0].id;
  });

  it("should create incident with source='manual'", async () => {
    const incidentId = await createIncident({
      buildingId: "TEST-MANUAL-001",
      source: "manual",
      createdByUserId: testUserId,
      callerId: "+1234567890",
    });

    expect(incidentId).toBeGreaterThan(0);

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const incident = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    expect(incident.length).toBe(1);
    expect(incident[0].source).toBe("manual");
    expect(incident[0].createdByUserId).toBe(testUserId);
    expect(incident[0].buildingId).toBe("TEST-MANUAL-001");
    expect(incident[0].status).toBe("open");
  });

  it("should create incident with source='telephony' by default", async () => {
    const incidentId = await createIncident({
      buildingId: "TEST-TELEPHONY-001",
      callerId: "+1234567890",
    });

    expect(incidentId).toBeGreaterThan(0);

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const incident = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    expect(incident.length).toBe(1);
    expect(incident[0].source).toBe("telephony");
    expect(incident[0].createdByUserId).toBeNull();
  });

  it("should store createdByUserId for manual incidents", async () => {
    const incidentId = await createIncident({
      buildingId: "TEST-MANUAL-002",
      source: "manual",
      createdByUserId: testUserId,
    });

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const incident = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    expect(incident[0].createdByUserId).toBe(testUserId);
  });

  it("should accept all required fields for manual incidents", async () => {
    const incidentId = await createIncident({
      buildingId: "TEST-MANUAL-003",
      source: "manual",
      createdByUserId: testUserId,
      callerId: "+1234567890",
      siteId: 1,
    });

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const incident = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    expect(incident[0].buildingId).toBe("TEST-MANUAL-003");
    expect(incident[0].callerId).toBe("+1234567890");
    expect(incident[0].siteId).toBe(1);
  });
});
