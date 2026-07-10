import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getGarminSession, linkGarminAccount } from "../services/garmin/client.js";
import { GarminConfigError } from "../services/garmin/crypto.js";
import { GarminAuthError, GarminUnavailableError } from "../services/garmin/types.js";
import { syncUser } from "../services/garmin/sync.js";
import { pushWeekToGarmin } from "../services/garmin/workoutPush.js";

const router = Router();

// Garmin's SSO locks accounts after repeated failed logins — keep connect
// attempts rare. Sync has its own 15-min cooldown; this is just a backstop.
const connectLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, name: "Garmin connect" });
const syncLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, name: "Garmin sync" });

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
    const { garminUserId } = await linkGarminAccount(
      userId,
      parsed.data.username,
      parsed.data.password,
    );

    // Initial backfill so the account lights up with data right away. Sync
    // failures don't undo the link — the user can retry from Settings.
    let sync = null;
    const session = await getGarminSession(userId);
    if (session) {
      try {
        sync = await syncUser(userId, session.api, { force: true });
        await session.persistTokens();
      } catch (err) {
        console.warn(
          `[garmin] initial sync failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    res.json({ connected: true, garminUserId, sync });
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

export default router;
