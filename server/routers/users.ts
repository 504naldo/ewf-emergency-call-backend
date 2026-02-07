import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getUserById, getUsersByRole, updateUserAvailability } from "../db";

export const usersRouter = router({
  // Get current user info - PROTECTED
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return await getUserById(ctx.user.id);
  }),

  // Get all techs (for admin board) - ADMIN ONLY
  getAllTechs: adminProcedure.query(async () => {
    return await getUsersByRole("tech");
  }),

  // Update availability toggle - PROTECTED
  updateAvailability: protectedProcedure
    .input(z.object({ available: z.boolean() }))
    .mutation(async ({ input, ctx }) => {

      await updateUserAvailability(ctx.user.id, input.available);

      return { success: true };
    }),

  // Toggle availability for any user - ADMIN ONLY
  toggleAvailability: adminProcedure
    .input(z.object({ userId: z.number(), available: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateUserAvailability(input.userId, input.available);
      return { success: true };
    }),
});
