import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reports, incidents } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const reportDataSchema = z.object({
  site: z.string().optional(),
  address: z.string().optional(),
  issueType: z.string().optional(),
  description: z.string().optional(),
  actionsTaken: z.string().optional(),
  partsUsed: z.string().optional(),
  photos: z.array(z.string()).optional(),
  status: z.enum(["resolved", "temporary", "follow_up"]).optional(),
  followUpNotes: z.string().optional(),
  arrivalTime: z.string().optional(), // ISO datetime string
  departTime: z.string().optional(), // ISO datetime string
  billableHours: z.number().optional(),
  techSignature: z.string().optional(),
  customerSignature: z.string().optional(),
});

export const reportsRouter = router({
  /**
   * Get report by incident ID
   * Permissions: Assigned tech, admin, or manager
   */
  getByIncident: protectedProcedure
    .input(z.object({ incidentId: z.number() }))
    .query(async ({ ctx, input }) => {      // Get incident to check permissions
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const incidentResult = await db.select().from(incidents).where(eq(incidents.id, input.incidentId)).limit(1);
      const incident = incidentResult.length > 0 ? incidentResult[0] : null;;

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      // Check permissions: assigned tech, admin, or manager
      const isAssignedTech = incident.assignedUserId === ctx.user.id;
      const isAdminOrManager = ctx.user.role === "admin" || ctx.user.role === "manager";

      if (!isAssignedTech && !isAdminOrManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view this report",
        });
      }

      // Get report
      const reportResult = await db.select().from(reports).where(eq(reports.incidentId, input.incidentId)).limit(1);
      const report = reportResult.length > 0 ? reportResult[0] : null;

      return report || null;
    }),

  /**
   * Upsert draft report
   * Permissions: Assigned tech only (for drafts)
   */
  upsertDraft: protectedProcedure
    .input(
      z.object({
        incidentId: z.number(),
        data: reportDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get incident to check permissions
      const incidentResult = await db.select().from(incidents).where(eq(incidents.id, input.incidentId)).limit(1);
      const incident = incidentResult.length > 0 ? incidentResult[0] : null;

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      // Check if user is assigned tech
      if (incident.assignedUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned technician can create/edit draft reports",
        });
      }

      // Check if report already exists
      const existingReportResult = await db.select().from(reports).where(eq(reports.incidentId, input.incidentId)).limit(1);
      const existingReport = existingReportResult.length > 0 ? existingReportResult[0] : null;

      if (existingReport) {
        // Check if already submitted
        if (existingReport.status === "submitted") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot edit a submitted report",
          });
        }

        // Update existing draft
        await db
          .update(reports)
          .set({
            jsonData: input.data,
            updatedAt: new Date(),
          })
          .where(eq(reports.id, existingReport.id));

        return { id: existingReport.id, status: "draft" as const };
      } else {
        // Create new draft
        const result = await db.insert(reports).values({
          incidentId: input.incidentId,
          techUserId: ctx.user.id,
          jsonData: input.data,
          status: "draft",
        });

        return { id: result[0].insertId, status: "draft" as const };
      }
    }),

  /**
   * Submit report (mark as final)
   * Permissions: Assigned tech only
   */
  submit: protectedProcedure
    .input(
      z.object({
        incidentId: z.number(),
        data: reportDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get incident to check permissions
      const incidentResult = await db.select().from(incidents).where(eq(incidents.id, input.incidentId)).limit(1);
      const incident = incidentResult.length > 0 ? incidentResult[0] : null;

      if (!incident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }

      // Check if user is assigned tech
      if (incident.assignedUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned technician can submit reports",
        });
      }

      // Check if report already exists
      const existingReportResult = await db.select().from(reports).where(eq(reports.incidentId, input.incidentId)).limit(1);
      const existingReport = existingReportResult.length > 0 ? existingReportResult[0] : null;

      if (existingReport) {
        // Check if already submitted
        if (existingReport.status === "submitted") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Report already submitted",
          });
        }

        // Update and submit
        await db
          .update(reports)
          .set({
            jsonData: input.data,
            status: "submitted",
            updatedAt: new Date(),
          })
          .where(eq(reports.id, existingReport.id));

        return { id: existingReport.id, status: "submitted" as const };
      } else {
        // Create and submit
        const result = await db.insert(reports).values({
          incidentId: input.incidentId,
          techUserId: ctx.user.id,
          jsonData: input.data,
          status: "submitted",
        });

        return { id: result[0].insertId, status: "submitted" as const };
      }
    }),
});
