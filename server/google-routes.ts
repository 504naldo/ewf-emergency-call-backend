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
  } catch (err) {
    console.error("[Google OAuth] Failed to generate auth URL:", err);
    res
      .status(500)
      .send("Failed to generate Google OAuth URL. Check server logs.");
  }
});

// ---------------------------------------------------------------------------
// GET /api/oauth/google/callback
// Receives the auth code from Google, exchanges it for tokens, and persists
// the refresh_token in the oauth_tokens table.
// ---------------------------------------------------------------------------
router.get("/oauth/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res
      .status(400)
      .send(
        "<html><body><h2>Error: Missing <code>code</code> query parameter.</h2></body></html>"
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
</body>
</html>`
    );
  } catch (err: any) {
    console.error("[Google OAuth] Callback error:", err);

    const isRefreshTokenMissing =
      typeof err?.message === "string" &&
      err.message.includes("refresh_token missing");

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

    res.status(500).send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>OAuth Error</title></head>
<body style="font-family:sans-serif;padding:2rem;">
  <h1 style="color:#c62828;">&#10007; OAuth Failed</h1>
  <p>An unexpected error occurred. Please check the server logs for details.</p>
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
  } catch (err) {
    console.error("[Google OAuth] Status check error:", err);
    res.status(500).json({ error: "Failed to check Google OAuth status." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/calendar/create-event
// Creates a Google Calendar event for a given incident.
//
// Body: { incidentId: string }
// The buildingId and description are loaded from the incidents table.
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

export default router;
