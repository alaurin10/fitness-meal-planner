import { Router } from "express";
import { fitPrisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { generateWeeklyPlan } from "../services/anthropic.js";

const router = Router();

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const plan = await fitPrisma.weeklyPlan.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ plan });
});

router.get("/history", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const plans = await fitPrisma.weeklyPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  res.json({ plans });
});

router.post("/generate", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const profile = await fitPrisma.fitProfile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [recentProgress, previousPlan] = await Promise.all([
    fitPrisma.progressLog.findMany({
      where: { userId, loggedAt: { gte: fourWeeksAgo } },
      orderBy: { loggedAt: "desc" },
    }),
    fitPrisma.weeklyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  try {
    const planJson = await generateWeeklyPlan({
      profile,
      recentProgress,
      previousPlan,
    });

    const weekStart = startOfWeek(new Date());

    await fitPrisma.weeklyPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const created = await fitPrisma.weeklyPlan.create({
      data: {
        userId,
        weekStartDate: weekStart,
        planJson,
        isActive: true,
      },
    });

    res.json({ plan: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fit plans] generate failed:", message);
    res.status(502).json({ error: "Failed to generate plan", detail: message });
  }
});

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default router;
