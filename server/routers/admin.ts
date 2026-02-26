import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";

export const adminRouter = router({
  executeSQL: adminProcedure
    .input(
      z.object({
        sql: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        const result: any = await db.execute(input.sql);
        
        // Handle different result types
        if (Array.isArray(result)) {
          return { rows: result };
        } else if (result.rows) {
          return { rows: result.rows };
        } else {
          return { 
            affectedRows: result.affectedRows || 0,
            insertId: result.insertId || 0,
            message: "Query executed successfully"
          };
        }
      } catch (error: any) {
        throw new Error(`SQL Error: ${error.message}`);
      }
    }),
});
