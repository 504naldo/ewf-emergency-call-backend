import { google } from "googleapis";
import { getDb } from "./db";
import { oauthTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Validate required env vars at startup and log clear errors if missing
// ---------------------------------------------------------------------------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID) {
  console.error("[Google OAuth] GOOGLE_CLIENT_ID environment variable is missing.");
}
if (!GOOGLE_CLIENT_SECRET) {
  console.error("[Google OAuth] GOOGLE_CLIENT_SECRET environment variable is missing.");
}
if (!GOOGLE_REDIRECT_URI) {
  console.error("[Google OAuth] GOOGLE_REDIRECT_URI environment variable is missing.");
}

// Default scopes include Calendar, Gmail send, and userinfo
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ---------------------------------------------------------------------------
// Build an authenticated OAuth2 client using the stored refresh token
// ---------------------------------------------------------------------------
async function getAuthClient(): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const db = await getDb();
  if (!db) throw new Error("[Google OAuth] Database not available.");

  const tokenRecord = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, "google"))
    .limit(1);

  if (!tokenRecord.length || !tokenRecord[0].refreshToken) {
    throw new Error(
      "[Google OAuth] No refresh token found. " +
        "Please authenticate first by visiting /api/oauth/google/start."
    );
  }

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: tokenRecord[0].refreshToken });
  return client;
}

// ---------------------------------------------------------------------------
// Generate the Google OAuth consent URL
// ---------------------------------------------------------------------------
export function getGoogleAuthUrl(): string {
  // Always include the required scopes; merge with any extra scopes from env
  const envScopes = process.env.GOOGLE_SCOPES
    ? process.env.GOOGLE_SCOPES.split(",").map((s) => s.trim())
    : [];
  const scopes = Array.from(new Set([...DEFAULT_SCOPES, ...envScopes]));

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    login_hint: "reports@ewandf.ca",
  });
}

// ---------------------------------------------------------------------------
// Exchange auth code for tokens and persist the refresh_token in MySQL.
// ---------------------------------------------------------------------------
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      "[Google OAuth] No refresh_token received from Google. " +
        "This usually means the account has already authorised this app. " +
        "To force a new refresh_token, revoke access at " +
        "https://myaccount.google.com/permissions and re-run /api/oauth/google/start."
    );
    throw new Error(
      "refresh_token missing from Google response. Please re-consent by visiting /api/oauth/google/start."
    );
  }

  const email = "reports@ewandf.ca";
  const db = await getDb();
  if (!db) throw new Error("[Google OAuth] Database not available.");

  const existing = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, "google"))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(oauthTokens)
      .set({ refreshToken: tokens.refresh_token, accountEmail: email })
      .where(eq(oauthTokens.provider, "google"));
    console.log(`[Google OAuth] Refresh token updated for ${email}.`);
  } else {
    await db.insert(oauthTokens).values({
      provider: "google",
      accountEmail: email,
      refreshToken: tokens.refresh_token,
    });
    console.log(`[Google OAuth] Refresh token stored for ${email}.`);
  }
}

// ---------------------------------------------------------------------------
// Create a Google Calendar event for a given incident
// ---------------------------------------------------------------------------
export async function createCalendarEvent(
  incidentId: string,
  buildingId: string,
  description: string
): Promise<{ eventId: string | null | undefined; htmlLink: string | null | undefined }> {
  const client = await getAuthClient();
  const calendar = google.calendar({ version: "v3", auth: client });

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const event = {
    summary: `Emergency Call \u2013 ${buildingId}`,
    description: `Incident ID: ${incidentId}\n\n${description}`,
    start: { dateTime: now.toISOString(), timeZone: "America/Toronto" },
    end: { dateTime: oneHourLater.toISOString(), timeZone: "America/Toronto" },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  return {
    eventId: response.data.id,
    htmlLink: response.data.htmlLink,
  };
}

// ---------------------------------------------------------------------------
// Send an incident report email via Gmail API
//
// Sends from reports@ewandf.ca to reports@ewandf.ca with full incident and
// report details formatted as HTML.
// ---------------------------------------------------------------------------
export interface IncidentEmailData {
  incidentId: number;
  buildingId?: string | null;
  callerId?: string | null;
  source?: string | null;
  status?: string | null;
  outcome?: string | null;
  outcomeNotes?: string | null;
  followUpRequired?: boolean | null;
  createdAt?: Date | null;
  resolvedAt?: Date | null;
  assignedTechName?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  report?: {
    site?: string | null;
    address?: string | null;
    issueType?: string | null;
    description?: string | null;
    actionsTaken?: string | null;
    partsUsed?: string | null;
    arrivalTime?: string | null;
    departTime?: string | null;
    billableHours?: number | null;
    followUpNotes?: string | null;
    status?: string | null;
    photos?: string[] | null;
  } | null;
}

export async function sendIncidentEmail(data: IncidentEmailData): Promise<string> {
  const client = await getAuthClient();
  const gmail = google.gmail({ version: "v1", auth: client });

  const RECIPIENT = "reports@ewandf.ca";
  const SENDER = "reports@ewandf.ca";

  const subject = `Incident Report – Building ${data.buildingId ?? data.incidentId} (ID #${data.incidentId})`;

  // Build HTML body
  const fmt = (val: any, fallback = "—") =>
    val !== null && val !== undefined && val !== "" ? String(val) : fallback;

  const yesNo = (val: boolean | null | undefined) =>
    val === true ? "Yes" : val === false ? "No" : "—";

  const photoLinks =
    data.report?.photos && data.report.photos.length > 0
      ? data.report.photos
          .map((url, i) => `<a href="${url}" target="_blank">Photo ${i + 1}</a>`)
          .join(" &nbsp;|&nbsp; ")
      : "—";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #222; background: #f9f9f9; margin: 0; padding: 0; }
    .wrapper { max-width: 680px; margin: 24px auto; background: #fff; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
    .header { background: #b71c1c; color: #fff; padding: 20px 28px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    .section { padding: 20px 28px; border-bottom: 1px solid #eee; }
    .section:last-child { border-bottom: none; }
    .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #b71c1c; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 8px; vertical-align: top; }
    td:first-child { width: 38%; font-weight: bold; color: #555; white-space: nowrap; }
    .footer { background: #f5f5f5; padding: 14px 28px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>&#128680; Incident Report Submitted</h1>
    <p>Incident #${data.incidentId} &mdash; Building ${fmt(data.buildingId)}</p>
  </div>

  <div class="section">
    <h2>Incident Details</h2>
    <table>
      <tr><td>Incident ID</td><td>#${data.incidentId}</td></tr>
      <tr><td>Building ID</td><td>${fmt(data.buildingId)}</td></tr>
      <tr><td>Site</td><td>${fmt(data.siteName ?? data.report?.site)}</td></tr>
      <tr><td>Address</td><td>${fmt(data.siteAddress ?? data.report?.address)}</td></tr>
      <tr><td>Caller ID</td><td>${fmt(data.callerId)}</td></tr>
      <tr><td>Source</td><td>${fmt(data.source)}</td></tr>
      <tr><td>Status</td><td>${fmt(data.status)}</td></tr>
      <tr><td>Outcome</td><td>${fmt(data.outcome)}</td></tr>
      <tr><td>Outcome Notes</td><td>${fmt(data.outcomeNotes)}</td></tr>
      <tr><td>Follow-Up Required</td><td>${yesNo(data.followUpRequired)}</td></tr>
      <tr><td>Created At</td><td>${data.createdAt ? data.createdAt.toLocaleString("en-CA", { timeZone: "America/Toronto" }) : "—"}</td></tr>
      <tr><td>Resolved At</td><td>${data.resolvedAt ? data.resolvedAt.toLocaleString("en-CA", { timeZone: "America/Toronto" }) : "—"}</td></tr>
      <tr><td>Assigned Technician</td><td>${fmt(data.assignedTechName)}</td></tr>
    </table>
  </div>

  ${data.report ? `
  <div class="section">
    <h2>Technician Report</h2>
    <table>
      <tr><td>Issue Type</td><td>${fmt(data.report.issueType)}</td></tr>
      <tr><td>Description</td><td>${fmt(data.report.description)}</td></tr>
      <tr><td>Actions Taken</td><td>${fmt(data.report.actionsTaken)}</td></tr>
      <tr><td>Parts Used</td><td>${fmt(data.report.partsUsed)}</td></tr>
      <tr><td>Resolution Status</td><td>${fmt(data.report.status)}</td></tr>
      <tr><td>Follow-Up Notes</td><td>${fmt(data.report.followUpNotes)}</td></tr>
      <tr><td>Arrival Time</td><td>${fmt(data.report.arrivalTime)}</td></tr>
      <tr><td>Depart Time</td><td>${fmt(data.report.departTime)}</td></tr>
      <tr><td>Billable Hours</td><td>${fmt(data.report.billableHours)}</td></tr>
      <tr><td>Photos</td><td>${photoLinks}</td></tr>
    </table>
  </div>
  ` : ""}

  <div class="footer">
    This email was automatically generated by the EWF Emergency Call system when a technician submitted their report.
  </div>
</div>
</body>
</html>`;

  // RFC 2822 raw message, base64url encoded
  const rawMessage = [
    `From: EWF Emergency System <${SENDER}>`,
    `To: ${RECIPIENT}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  console.log(
    `[Gmail] Report email sent for incident #${data.incidentId}. Message ID: ${response.data.id}`
  );

  return response.data.id ?? "";
}

// ---------------------------------------------------------------------------
// Check whether a refresh token is stored (for /api/oauth/google/status)
// ---------------------------------------------------------------------------
export async function hasRefreshToken(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const tokenRecord = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, "google"))
    .limit(1);

  return tokenRecord.length > 0 && !!tokenRecord[0].refreshToken;
}
