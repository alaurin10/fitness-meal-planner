import { Router } from "express";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

/** Return the UTC start-of-day for "today" in the server's perspective. */
function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const date = todayUTC();

  const log = await prisma.hydrationLog.findUnique({
    where: { userId_date: { userId, date } },
  });

  res.json({ cups: log?.cups ?? 0 });
});

router.post("/increment", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const date = todayUTC();

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
