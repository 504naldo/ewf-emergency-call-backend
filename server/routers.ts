import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { incidentsRouter } from "./routers/incidents";
import { usersRouter } from "./routers/users";
import { configRouter } from "./routers/config";
import { reportsRouter } from "./routers/reports";
import { healthRouter } from "./routers/health";
import { adminRouter } from "./routers/admin";
import { getUserByEmail } from "./db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email);

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isValidPassword = await bcrypt.compare(input.password, user.password);

        if (!isValidPassword) {
          throw new Error("Invalid email or password");
        }

        if (!process.env.JWT_SECRET) {
          throw new Error("JWT_SECRET not configured");
        }

        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30d" }
        );

        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Feature routers
  health: healthRouter,
  incidents: incidentsRouter,
  users: usersRouter,
  config: configRouter,
  reports: reportsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
