import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  completeLinkWithMfa,
  getGarminSession,
  linkWithImportedTokens,
  startLink,
} from "../services/garmin/client.js";
import { GarminConfigError } from "../services/garmin/crypto.js";
import { GarminAuthError, GarminUnavailableError } from "../services/garmin/types.js";
import { syncUser } from "../services/garmin/sync.js";
import { pushWeekToGarmin } from "../services/garmin/workoutPush.js";
import { checkWatchSession } from "../services/garmin/setSyncBack.js";

const router = Router();

// Garmin's SSO locks accounts after repeated failed logins — keep connect
// attempts rare. Sync has its own 15-min cooldown; this is just a backstop.
const connectLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, name: "Garmin connect" });
const mfaLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, name: "Garmin MFA" });
const syncLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, name: "Garmin sync" });
// Watch-session polling backstop; the real throttle is the per-user 60s floor
// between Garmin calls inside checkWatchSession.
const watchLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, name: "watch session" });

// Kick the initial 30-day backfill in the background. Running it inline would hold
// the HTTP request open for minutes (sequential Garmin calls) and surface as a
// client-side "Network Error"; the Settings card polls status while data fills in.
// Sync failures don't undo the link — lastSyncStatus/lastSyncError reflect them.
function kickInitialSync(userId: string): void {
  void (async () => {
    try {
      const session = await getGarminSession(userId);
      if (!session) return;
      await syncUser(userId, session.api, { force: true });
      await session.persistTokens();
    } catch (err) {
      console.warn(
        `[garmin] initial sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  })();
}

function respondGarminError(res: Response, err: unknown): boolean {
  if (err instanceof GarminConfigError) {
    res.status(503).json({ error: "Garmin integration is not configured on this server" });
    return true;
  }
  if (err instanceof GarminAuthError) {
    res.status(401).json({ error: err.message, reconnectRequired: true });
    return true;
  }
  if (err instanceof GarminUnavailableError) {
    res.status(502).json({ error: err.message });
    return true;
  }
  return false;
}

const connectSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

router.post("/connect", requireAuth, connectLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    const { mfaRequired, garminUserId } = await startLink(
      userId,
      parsed.data.username,
      parsed.data.password,
    );

    // Two-step verification: don't sync yet — wait for the code at /connect/mfa.
    if (mfaRequired) {
      res.json({ mfaRequired: true });
      return;
    }

    res.json({ connected: true, garminUserId });
    kickInitialSync(userId);
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

const mfaSchema = z.object({ code: z.string().trim().regex(/^\d{4,10}$/) });

router.post("/connect/mfa", requireAuth, mfaLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = mfaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the numeric verification code Garmin sent you" });
    return;
  }

  try {
    const { garminUserId } = await completeLinkWithMfa(userId, parsed.data.code);
    res.json({ connected: true, garminUserId });
    kickInitialSync(userId);
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

// Escape hatch for when Garmin's SSO rate-limits this server's shared hosting
// IP and in-app sign-in can't complete: the user signs in from their own
// machine (`pnpm --filter @app/server garmin:export-tokens`) and pastes the
// printed token JSON here. Tokens are verified against Garmin before storage.
// Body/response are never logged — the paste contains live OAuth tokens.
const importSchema = z.object({ tokens: z.string().min(1).max(20_000) });

router.post("/connect/import", requireAuth, connectLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Paste the token JSON printed by the export script" });
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(parsed.data.tokens);
  } catch {
    res.status(400).json({
      error: "That isn't valid JSON — paste the exact line printed by the export script",
    });
    return;
  }

  try {
    const { garminUserId } = await linkWithImportedTokens(userId, raw);
    res.json({ connected: true, garminUserId });
    kickInitialSync(userId);
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

router.get("/status", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const connection = await prisma.garminConnection.findUnique({ where: { userId } });
  if (!connection) {
    res.json({ connected: false });
    return;
  }
  res.json({
    connected: true,
    garminUserId: connection.garminUserId,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncError: connection.lastSyncError,
  });
});

const syncSchema = z.object({ force: z.boolean().optional() }).optional();

router.post("/sync", requireAuth, syncLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = syncSchema.safeParse(req.body ?? {});
  const force = parsed.success ? (parsed.data?.force ?? false) : false;

  try {
    const session = await getGarminSession(userId);
    if (!session) {
      res.status(400).json({ error: "Garmin is not connected" });
      return;
    }
    const result = await syncUser(userId, session.api, { force });
    if (!result.skipped) await session.persistTokens();
    res.json(result);
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

router.delete("/connection", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await prisma.garminConnection.deleteMany({ where: { userId } });
  // Synced wellness/activity/weight data intentionally survives disconnection.
  res.json({ ok: true });
});

const pushWeekSchema = z.object({ planId: z.string().min(1) });

router.post("/push-week", requireAuth, syncLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = pushWeekSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "planId is required" });
    return;
  }

  try {
    const session = await getGarminSession(userId);
    if (!session) {
      res.status(400).json({ error: "Garmin is not connected" });
      return;
    }
    const plan = await prisma.weeklyPlan.findUnique({ where: { id: parsed.data.planId } });
    if (!plan || plan.userId !== userId) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    const days = await pushWeekToGarmin(userId, session.api, plan);
    await session.persistTokens();
    res.json({ days });
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

// One poll of the "doing this on my watch" live session: looks for today's
// saved strength activity on Garmin and, once it appears, maps its sets onto
// the plan and returns the merged completion. The client polls this (~75s).
const watchSessionSchema = z.object({
  planId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/watch-session/check", requireAuth, watchLimiter, async (req, res, next) => {
  const userId = currentUserId(req);
  const parsed = watchSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "planId and dayKey (YYYY-MM-DD) are required" });
    return;
  }

  try {
    const session = await getGarminSession(userId);
    if (!session) {
      res.status(400).json({ error: "Garmin is not connected" });
      return;
    }
    const result = await checkWatchSession(userId, session.api, parsed.data);
    if (!result) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    if (result.madeGarminCall) await session.persistTokens();
    const { madeGarminCall: _ignored, ...body } = result;
    res.json(result.status === "waiting" ? { ...body, nextPollSeconds: 75 } : body);
  } catch (err) {
    if (!respondGarminError(res, err)) next(err);
  }
});

export default router;
