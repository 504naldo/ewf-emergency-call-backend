// Only load dotenv in development (Railway provides env vars directly)
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

import webhookRoutes from "../webhooks";
import authRoutes from "../auth";
import twilioWebhookRoutes from "../twilio-webhooks";

async function startServer( ) {
  const app = express();
  app.use(express.static('public'));
  const server = createServer(app);
  
  // Debug logger - remove later
  app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.path} origin=${req.headers.origin ?? "none"}`);
    next();
  });

  // CORS (allow all origins including local files)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow requests from browsers with origin header OR from local files (no origin)
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      res.header("Access-Control-Allow-Origin", "*");
      // Don't set credentials header when origin is *
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  // REST routes
  app.use("/api", authRoutes);
  app.use("/api", webhookRoutes);
  app.use("/api", twilioWebhookRoutes);

  // Health endpoints
  app.get("/", (_req, res) => res.status(200).send("OK"));
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok", timestamp: Date.now() }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: Date.now() }));

  // Custom REST endpoint for SQL execution (admin tool)
  app.post("/api/admin/execute-sql", async (req, res) => {
    try {
      const { sql } = req.body;
      
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ error: 'SQL query is required' });
      }

      const { getDb } = await import('../db');
      const db = await getDb();
      
      if (!db) {
        return res.status(500).json({ error: 'Database not available' });
      }

      const result: any = await db.execute(sql);
      
      // Handle different result types
      if (Array.isArray(result)) {
        return res.json({ rows: result });
      } else if (result.rows) {
        return res.json({ rows: result.rows });
      } else {
        return res.json({ 
          affectedRows: result.affectedRows || 0,
          insertId: result.insertId || 0,
          message: "Query executed successfully"
        });
      }
    } catch (error: any) {
      console.error('[SQL Error]', error);
      return res.status(500).json({ error: `SQL Error: ${error.message}` });
    }
  });

  // tRPC endpoint
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // ✅ Railway/Render/etc: always use PORT if provided
  const port = Number(process.env.PORT ?? 3000);

  // ✅ bind 0.0.0.0 so Railway can route traffic into the container
  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on 0.0.0.0:${port}`);
    console.log(`[api] environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch(console.error);
