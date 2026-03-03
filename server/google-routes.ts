import { Router } from "express";
import type { Request, Response } from "express";
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  createCalendarEvent,
  hasRefreshToken,
} from "./google";
import { getDb } from "./db";
import { incidents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/oauth/google/start
// Redirects the browser to Google's OAuth consent page.
// ---------------------------------------------------------------------------
router.get("/oauth/google/start", (_req: Request, res: Response) => {
  try {
    const url = getGoogleAuthUrl();
    res.redirect(url);
  } catch (err: any) {
    console.error("[Google OAuth] Failed to generate auth URL:", err);
    res.status(500).send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>OAuth Start Error</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#10007; Failed to start OAuth</h1>
  <p><strong>Error:</strong> ${escHtml(err?.message ?? String(err))}</p>
  <p>Check that <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>GOOGLE_REDIRECT_URI</code> are set in Railway.</p>
</body>
</html>`
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/oauth/google/callback
// Receives the auth code from Google, exchanges it for tokens, and persists
// the refresh_token in the oauth_tokens table.
// ---------------------------------------------------------------------------
router.get("/oauth/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  // Google returned an error (e.g. access_denied)
  if (error) {
    console.error("[Google OAuth] Google returned error:", error);
    return res.status(400).send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>OAuth Denied</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#9888; Google returned an error</h1>
  <p><strong>Error from Google:</strong> <code>${escHtml(error)}</code></p>
  <p>Please try again: <a href="/api/oauth/google/start">/api/oauth/google/start</a></p>
</body>
</html>`
    );
  }

  if (!code) {
    return res.status(400).send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>OAuth Error</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#10007; Missing code parameter</h1>
  <p>The callback did not receive a <code>code</code> query parameter from Google.</p>
</body>
</html>`
    );
  }

  try {
    await exchangeCodeForTokens(code);
    res.send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Google OAuth Success</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#2e7d32;">&#10003; Google OAuth Successful</h1>
  <p>The refresh token for <strong>reports@ewandf.ca</strong> has been stored.</p>
  <p>You can close this window. The backend will now create Google Calendar events automatically.</p>
  <p><a href="/api/oauth/google/status">Check status</a></p>
</body>
</html>`
    );
  } catch (err: any) {
    console.error("[Google OAuth] Callback error:", err);

    const msg: string = err?.message ?? String(err);
    const isRefreshTokenMissing = msg.includes("refresh_token missing");

    if (isRefreshTokenMissing) {
      return res.status(400).send(
        `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Re-consent Required</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#9888; Re-consent Required</h1>
  <p>Google did not return a <code>refresh_token</code>. This happens when the app has already been authorised.</p>
  <p>To fix this:</p>
  <ol>
    <li>Visit <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a></li>
    <li>Revoke access for this application</li>
    <li>Visit <a href="/api/oauth/google/start">/api/oauth/google/start</a> again</li>
  </ol>
</body>
</html>`
      );
    }

    // Show the actual error message so it can be diagnosed without log access
    const detail = escHtml(msg);
    const stack = escHtml((err?.stack ?? "").split("\n").slice(0, 6).join("\n"));

    return res.status(500).send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>OAuth Error</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#10007; OAuth Failed</h1>
  <p><strong>Error:</strong> ${detail}</p>
  <pre style="background:#f5f5f5;padding:1rem;border-radius:4px;overflow:auto;font-size:0.85rem;">${stack}</pre>
  <hr/>
  <h2>Common causes</h2>
  <ul>
    <li><strong>Table does not exist</strong> — run the migration: <code>drizzle/0007_add_oauth_tokens.sql</code> against your Railway MySQL instance, or run <code>pnpm db:push</code>.</li>
    <li><strong>Wrong client secret</strong> — verify <code>GOOGLE_CLIENT_SECRET</code> in Railway matches Google Cloud Console.</li>
    <li><strong>Redirect URI mismatch</strong> — <code>GOOGLE_REDIRECT_URI</code> must exactly match the URI registered in Google Cloud Console (including https and no trailing slash).</li>
  </ul>
  <p><a href="/api/oauth/google/debug">View environment diagnostics</a></p>
</body>
</html>`
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/oauth/google/status
// Returns whether a valid refresh token is stored.
// ---------------------------------------------------------------------------
router.get("/oauth/google/status", async (_req: Request, res: Response) => {
  try {
    const connected = await hasRefreshToken();
    res.json({
      connected,
      message: connected
        ? "Google Calendar is connected. Refresh token is stored."
        : "Google Calendar is NOT connected. Visit /api/oauth/google/start to authorise.",
    });
  } catch (err: any) {
    console.error("[Google OAuth] Status check error:", err);
    res.status(500).json({
      error: "Failed to check Google OAuth status.",
      detail: err?.message ?? String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/oauth/google/debug
// Shows which required env vars are present (values masked) and whether the
// oauth_tokens table is reachable. Useful for diagnosing Railway deployments.
// ---------------------------------------------------------------------------
router.get("/oauth/google/debug", async (_req: Request, res: Response) => {
  const vars = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "✓ set" : "✗ MISSING",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "✓ set" : "✗ MISSING",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? "✗ MISSING",
    GOOGLE_SCOPES: process.env.GOOGLE_SCOPES ?? "(using defaults)",
    DATABASE_URL: process.env.DATABASE_URL ? "✓ set" : "✗ MISSING",
    NODE_ENV: process.env.NODE_ENV ?? "not set",
  };

  let dbStatus = "unknown";
  let tokenCount = 0;
  try {
    const db = await getDb();
    if (db) {
      const rows = await db.execute("SELECT COUNT(*) as cnt FROM oauth_tokens");
      const cnt = (rows as any)[0]?.[0]?.cnt ?? (rows as any)[0]?.cnt ?? "?";
      tokenCount = Number(cnt);
      dbStatus = `✓ reachable — ${tokenCount} token row(s) in oauth_tokens`;
    } else {
      dbStatus = "✗ getDb() returned null";
    }
  } catch (e: any) {
    dbStatus = `✗ ${e?.message ?? String(e)}`;
  }

  const rows = Object.entries(vars)
    .map(([k, v]) => `<tr><td style="padding:4px 12px;font-family:monospace">${escHtml(k)}</td><td style="padding:4px 12px">${escHtml(v)}</td></tr>`)
    .join("\n");

  res.send(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Google OAuth Debug</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1>Google OAuth Diagnostics</h1>
  <h2>Environment Variables</h2>
  <table border="1" cellspacing="0" style="border-collapse:collapse">
    <thead><tr><th style="padding:4px 12px">Variable</th><th style="padding:4px 12px">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Database</h2>
  <p>${escHtml(dbStatus)}</p>
  <h2>Actions</h2>
  <ul>
    <li><a href="/api/oauth/google/start">Start OAuth flow</a></li>
    <li><a href="/api/oauth/google/status">Check token status (JSON)</a></li>
  </ul>
</body>
</html>`
  );
});

// ---------------------------------------------------------------------------
// POST /api/calendar/create-event
// Creates a Google Calendar event for a given incident.
//
// Body: { incidentId: string }
// ---------------------------------------------------------------------------
router.post("/calendar/create-event", async (req: Request, res: Response) => {
  const { incidentId } = req.body as { incidentId?: string };

  if (!incidentId) {
    return res.status(400).json({ error: "incidentId is required." });
  }

  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available." });
    }

    const incidentRows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, Number(incidentId)))
      .limit(1);

    if (!incidentRows.length) {
      return res
        .status(404)
        .json({ error: `Incident ${incidentId} not found.` });
    }

    const incident = incidentRows[0];
    const buildingId = incident.buildingId ?? incidentId;
    const description = [
      `Incident ID: ${incident.id}`,
      incident.buildingId ? `Building: ${incident.buildingId}` : null,
      incident.callerId ? `Caller: ${incident.callerId}` : null,
      incident.status ? `Status: ${incident.status}` : null,
      incident.outcomeNotes ? `Notes: ${incident.outcomeNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await createCalendarEvent(
      incidentId,
      buildingId,
      description
    );

    res.json({
      eventId: result.eventId,
      htmlLink: result.htmlLink,
    });
  } catch (err: any) {
    console.error("[Google Calendar] create-event error:", err);
    res
      .status(500)
      .json({ error: err?.message ?? "Failed to create calendar event." });
  }
});

// ---------------------------------------------------------------------------
// Utility: escape HTML special characters
// ---------------------------------------------------------------------------
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
