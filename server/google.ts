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

// ---------------------------------------------------------------------------
// Generate the Google OAuth consent URL
// ---------------------------------------------------------------------------
export function getGoogleAuthUrl(): string {
  const scopes =
    process.env.GOOGLE_SCOPES
      ? process.env.GOOGLE_SCOPES.split(",").map((s) => s.trim())
      : [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/userinfo.email",
        ];

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
}

// ---------------------------------------------------------------------------
// Exchange auth code for tokens and persist the refresh_token in MySQL
// ---------------------------------------------------------------------------
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

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

  // Fetch the authenticated account's email address
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const userInfoResponse = await oauth2.userinfo.get();
  const email: string =
    (userInfoResponse.data as { email?: string }).email ?? "reports@ewandf.ca";

  const db = await getDb();
  if (!db) throw new Error("[Google OAuth] Database not available.");

  // Upsert: replace any existing token for this provider
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
  const db = await getDb();
  if (!db) throw new Error("[Google Calendar] Database not available.");

  const tokenRecord = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, "google"))
    .limit(1);

  if (!tokenRecord.length || !tokenRecord[0].refreshToken) {
    throw new Error(
      "[Google Calendar] No refresh token found. " +
        "Please authenticate first by visiting /api/oauth/google/start."
    );
  }

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: tokenRecord[0].refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const event = {
    summary: `Emergency Call \u2013 ${buildingId}`,
    description: `Incident ID: ${incidentId}\n\n${description}`,
    start: {
      dateTime: now.toISOString(),
      timeZone: "America/Toronto",
    },
    end: {
      dateTime: oneHourLater.toISOString(),
      timeZone: "America/Toronto",
    },
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
