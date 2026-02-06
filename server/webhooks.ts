import { Router } from "express";
import {
  createIncident,
  logIncidentEvent,
  updateCallAttempt,
  assignIncident,
  handleAnsweredUnclaimed,
  startRouting,
} from "./routing-engine";
import { matchSiteByPhone } from "./db";

const router = Router();

// ============================================================================
// Webhook Types
// ============================================================================

type IncomingCallPayload = {
  callId: string;
  from: string;
  to: string;
  timestamp: string;
};

type RingingPayload = {
  callId: string;
  targetPhone: string;
  timestamp: string;
};

type AnsweredPayload = {
  callId: string;
  answeredBy: string;
  timestamp: string;
};

type CompletedPayload = {
  callId: string;
  duration: number;
  timestamp: string;
};

type MissedPayload = {
  callId: string;
  targetPhone: string;
  reason: string;
  timestamp: string;
};

// ============================================================================
// Webhook Endpoints
// ============================================================================

/**
 * Incoming Call Webhook
 * Triggered when a new emergency call comes in
 */
router.post("/webhooks/telephony/incoming_call", async (req, res) => {
  try {
    const payload: IncomingCallPayload = req.body;

    console.log("[Webhook] Incoming call:", payload);

    // Match site by caller ID
    const site = await matchSiteByPhone(payload.from);

    // Create incident immediately
    const incidentId = await createIncident({
      externalId: payload.callId,
      callerId: payload.from,
      siteId: site?.id,
    });

    // Log webhook event
    await logIncidentEvent({
      incidentId,
      type: "webhook_received",
      payloadJson: { event: "incoming_call", ...payload },
    });

    // Start routing through ladder
    await startRouting(incidentId);

    res.json({ success: true, incidentId });
  } catch (error: any) {
    console.error("[Webhook] Incoming call error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Ringing Webhook
 * Triggered when a call starts ringing for a technician
 */
router.post("/webhooks/telephony/ringing", async (req, res) => {
  try {
    const payload: RingingPayload = req.body;

    console.log("[Webhook] Ringing:", payload);

    // TODO: Update call attempt status to ringing
    // This would require looking up the call attempt by callId
    // For now, we'll just log the event

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Ringing error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Answered Webhook
 * Triggered when a technician answers the call
 */
router.post("/webhooks/telephony/answered", async (req, res) => {
  try {
    const payload: AnsweredPayload = req.body;

    console.log("[Webhook] Answered:", payload);

    // TODO: Find the incident and call attempt by callId
    // Mark the call attempt as answered
    // Start 90-second timer for claim detection
    // If not claimed within 90s, trigger handleAnsweredUnclaimed

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Answered error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Completed Webhook
 * Triggered when a call ends
 */
router.post("/webhooks/telephony/completed", async (req, res) => {
  try {
    const payload: CompletedPayload = req.body;

    console.log("[Webhook] Completed:", payload);

    // TODO: Update call attempt with completion status
    // Log incident event

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Completed error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Missed Webhook
 * Triggered when a call is not answered (timeout or declined)
 */
router.post("/webhooks/telephony/missed", async (req, res) => {
  try {
    const payload: MissedPayload = req.body;

    console.log("[Webhook] Missed:", payload);

    // TODO: Update call attempt with missed/declined status
    // Trigger next step in routing ladder

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Missed error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Test Endpoint
// ============================================================================

/**
 * Test endpoint to simulate an incoming emergency call
 * Usage: POST /webhooks/telephony/test
 */
const handleTestCall = async (res: any) => {
  try {
    const testPayload: IncomingCallPayload = {
      callId: `test-${Date.now()}`,
      from: "+1234560000", // Matches Downtown Office
      to: "+1800EMERGENCY",
      timestamp: new Date().toISOString(),
    };

    console.log("[Webhook] Test call initiated:", testPayload);

    // Create incident and start routing
    const site = await matchSiteByPhone(testPayload.from);
    const incidentId = await createIncident({
      externalId: testPayload.callId,
      callerId: testPayload.from,
      siteId: site?.id,
    });

    await logIncidentEvent({
      incidentId,
      type: "webhook_received",
      payloadJson: { event: "test_call", ...testPayload },
    });

    await startRouting(incidentId);

    res.json({ success: true, incidentId, message: "Test call initiated" });
  } catch (error: any) {
    console.error("[Webhook] Test error:", error);
    res.status(500).json({ error: error.message });
  }
};

router.post("/webhooks/telephony/test", async (req, res) => {
  await handleTestCall(res);
});

/**
 * DEV-ONLY: GET endpoint for browser-based testing
 * Usage: GET /webhooks/telephony/test
 * WARNING: This endpoint is only available in development mode
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/webhooks/telephony/test", async (req, res) => {
    await handleTestCall(res);
  });
}

export default router;
