import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import jwt from "jsonwebtoken";
import { getDb } from "../db";

const { verify } = jwt;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Try JWT authentication first
    const authHeader = opts.req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
      
      try {
        const decoded = verify(token, JWT_SECRET) as { userId: number };
        const db = await getDb();
        if (db) {
          // Use Drizzle ORM query
          const { users } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const result = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
          if (result.length > 0) {
            user = result[0];
            console.log("[tRPC Context] JWT auth successful for user:", user.email);
          }
        }
      } catch (error) {
        console.error("[tRPC Context] JWT verification failed:", error);
      }
    }
    
    // Fallback to OAuth SDK authentication if JWT failed
    if (!user) {
      try {
        user = await sdk.authenticateRequest(opts.req);
        console.log("[tRPC Context] OAuth auth successful for user:", user?.email);
      } catch (error) {
        // Authentication is optional for public procedures.
        console.log("[tRPC Context] No authentication found");
      }
    }
  } catch (error) {
    console.error("[tRPC Context] Authentication error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
