import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getSystemConfig, setSystemConfig } from "../db";

export const configRouter = router({
  // Get business hours configuration - PROTECTED (all users can view)
  getBusinessHours: protectedProcedure.query(async () => {
    return await getSystemConfig("business_hours");
  }),

  // Update business hours configuration - ADMIN ONLY
  updateBusinessHours: adminProcedure
    .input(
      z.object({
        days: z.array(z.number().min(0).max(6)),
        startHour: z.number().min(0).max(23),
        startMinute: z.number().min(0).max(59),
        endHour: z.number().min(0).max(23),
        endMinute: z.number().min(0).max(59),
        timezone: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await setSystemConfig("business_hours", input);

      return { success: true };
    }),

  // Get ring duration - PROTECTED (all users can view)
  getRingDuration: protectedProcedure.query(async () => {
    return await getSystemConfig("ring_duration");
  }),

  // Update ring duration - ADMIN ONLY
  updateRingDuration: adminProcedure
    .input(z.object({ seconds: z.number().min(10).max(60) }))
    .mutation(async ({ input, ctx }) => {

      await setSystemConfig("ring_duration", input);

      return { success: true };
    }),

  // Get business hours ladder
  getBusinessHoursLadder: publicProcedure.query(async () => {
    return await getSystemConfig("business_hours_ladder");
  }),

  // Update business hours ladder
  updateBusinessHoursLadder: adminProcedure
    .input(
      z.object({
        steps: z.array(z.string()),
      })
    )
    .mutation(async ({ input }) => {
      await setSystemConfig("business_hours_ladder", input);

      return { success: true };
    }),

  // Get after hours ladder
  getAfterHoursLadder: publicProcedure.query(async () => {
    return await getSystemConfig("after_hours_ladder");
  }),

  // Update after hours ladder
  updateAfterHoursLadder: adminProcedure
    .input(
      z.object({
        steps: z.array(z.string()),
      })
    )
    .mutation(async ({ input }) => {
      await setSystemConfig("after_hours_ladder", input);

      return { success: true };
    }),
});
