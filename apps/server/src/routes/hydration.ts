import { Router } from "express";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert a local-date dayKey (YYYY-MM-DD) into the canonical Date we store in
 * HydrationLog.date — midnight UTC of that calendar day. This keeps storage
 * stable while letting the client decide which day "today" is in their tz.
 */
function dayKeyToDate(dayKey: string): Date {
  return new Date(dayKey + "T00:00:00.000Z");
}

function serverLocalDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolveDayKey(input: unknown): string {
  return typeof input === "string" && DAY_KEY_RE.test(input)
    ? input
    : serverLocalDayKey();
}

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const dayKey = resolveDayKey(req.query.dayKey);
  const date = dayKeyToDate(dayKey);

  const log = await prisma.hydrationLog.findUnique({
    where: { userId_date: { userId, date } },
  });

  res.json({ cups: log?.cups ?? 0 });
});

router.post("/increment", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const dayKey = resolveDayKey(req.body?.dayKey);
  const date = dayKeyToDate(dayKey);

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const log = await prisma.hydrationLog.upsert({
    where: { userId_date: { userId, date } },
    update: { cups: { increment: 1 } },
    create: { userId, date, cups: 1 },
  });

  res.json({ cups: log.cups });
});

export default router;
