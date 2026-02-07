import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  index,
} from "drizzle-orm/mysql-core";

// ============================================================================
// Users & Authentication
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }), // bcrypt hash
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["tech", "admin", "manager"]).default("tech").notNull(),
  active: boolean("active").default(true).notNull(),
  available: boolean("available").default(true).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// On-Call Scheduling
// ============================================================================

export const oncallSchedule = mysqlTable("oncall_schedule", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  priorityOrder: int("priorityOrder").notNull(), // 1 = primary, 2 = secondary
  isPrimary: boolean("isPrimary").default(false).notNull(),
  isSecondary: boolean("isSecondary").default(false).notNull(),
  eligiblePool: boolean("eligiblePool").default(true).notNull(), // For rotating pool
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  timeRangeIdx: index("time_range_idx").on(table.startTime, table.endTime),
}));

// ============================================================================
// Rotation State
// ============================================================================

export const rotationState = mysqlTable("rotation_state", {
  id: int("id").autoincrement().primaryKey(),
  pointerIndex: int("pointerIndex").default(0).notNull(),
  lastUsedUserIds: json("lastUsedUserIds").$type<number[]>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// Sites
// ============================================================================

export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  notes: text("notes"),
  phoneMatchRules: json("phoneMatchRules").$type<string[]>(), // Array of phone patterns
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("name_idx").on(table.name),
}));

// ============================================================================
// Incidents
// ============================================================================

export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 255 }).unique(), // From telephony provider
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  bhAh: mysqlEnum("bhAh", ["business_hours", "after_hours"]).notNull(),
  callerId: varchar("callerId", { length: 50 }),
  siteId: int("siteId"),
  buildingId: varchar("buildingId", { length: 100 }), // Building identifier
  status: mysqlEnum("status", [
    "open",
    "en_route",
    "on_site",
    "resolved",
    "follow_up_required",
  ]).default("open").notNull(),
  assignedUserId: int("assignedUserId"),
  critical: boolean("critical").default(false).notNull(),
  answeredUnclaimed: boolean("answeredUnclaimed").default(false).notNull(),
  outcome: mysqlEnum("outcome", [
    "nuisance",
    "device_issue",
    "panel_trouble",
    "unknown",
    "other",
  ]),
  outcomeNotes: text("outcomeNotes"),
  followUpRequired: boolean("followUpRequired").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  assignedUserIdx: index("assigned_user_idx").on(table.assignedUserId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  externalIdIdx: index("external_id_idx").on(table.externalId),
}));

// ============================================================================
// Call Attempts
// ============================================================================

export const callAttempts = mysqlTable("call_attempts", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull(),
  step: int("step").notNull(), // Ladder step number
  targetUserId: int("targetUserId").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  result: mysqlEnum("result", ["ringing", "answered", "missed", "declined", "timeout"]),
  declineReason: mysqlEnum("declineReason", [
    "busy",
    "already_on_call",
    "out_of_area",
    "other",
  ]),
  declineReasonText: text("declineReasonText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  incidentIdIdx: index("incident_id_idx").on(table.incidentId),
  targetUserIdIdx: index("target_user_id_idx").on(table.targetUserId),
}));

// ============================================================================
// Incident Events (Audit Trail)
// ============================================================================

export const incidentEvents = mysqlTable("incident_events", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., "status_changed", "assigned", "note_added", "webhook_received"
  userId: int("userId"), // Nullable for system events
  at: timestamp("at").defaultNow().notNull(),
  payloadJson: json("payloadJson").$type<Record<string, any>>(),
}, (table) => ({
  incidentIdIdx: index("incident_id_idx").on(table.incidentId),
  typeIdx: index("type_idx").on(table.type),
}));

// ============================================================================
// Notifications
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., "emergency_call", "incident_assigned", "incident_updated"
  incidentId: int("incidentId"),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  deepLink: varchar("deepLink", { length: 500 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

// ============================================================================
// Incident Reports
// ============================================================================

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull(),
  techUserId: int("techUserId").notNull(),
  jsonData: json("jsonData").$type<{
    site?: string;
    address?: string;
    issueType?: string;
    description?: string;
    actionsTaken?: string;
    partsUsed?: string;
    photos?: string[]; // S3 URLs
    status?: "resolved" | "temporary" | "follow_up";
    followUpNotes?: string;
    techSignature?: string; // Base64 or S3 URL
    customerSignature?: string; // Base64 or S3 URL
  }>().notNull(),
  status: mysqlEnum("status", ["draft", "submitted"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  incidentIdIdx: index("incident_id_idx").on(table.incidentId),
  techUserIdIdx: index("tech_user_id_idx").on(table.techUserId),
  statusIdx: index("status_idx").on(table.status),
}));

// ============================================================================
// System Configuration
// ============================================================================

export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: json("value").$type<any>().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type OncallSchedule = typeof oncallSchedule.$inferSelect;
export type InsertOncallSchedule = typeof oncallSchedule.$inferInsert;

export type RotationState = typeof rotationState.$inferSelect;
export type InsertRotationState = typeof rotationState.$inferInsert;

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

export type CallAttempt = typeof callAttempts.$inferSelect;
export type InsertCallAttempt = typeof callAttempts.$inferInsert;

export type IncidentEvent = typeof incidentEvents.$inferSelect;
export type InsertIncidentEvent = typeof incidentEvents.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
