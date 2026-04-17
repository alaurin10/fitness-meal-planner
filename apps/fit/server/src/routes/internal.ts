import { Router } from "express";
import { fitPrisma } from "@platform/db";
import { requireInternal } from "../middleware/auth.js";

const router = Router();

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const CALORIE_PER_SESSION_ESTIMATE: Record<string, number> = {
  build_muscle: 350,
  lose_fat: 450,
  maintain: 300,
};

router.get("/schedule", requireInternal, async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }

  const [profile, plan] = await Promise.all([
    fitPrisma.fitProfile.findUnique({ where: { userId } }),
    fitPrisma.weeklyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) {
    res.json({
      trainingDays: [],
      avgDailyCaloriesBurned: 0,
      goal: null,
    });
    return;
  }

  const trainingDays = extractTrainingDays(plan?.planJson, profile.trainingDaysPerWeek);
  const burnPerSession = CALORIE_PER_SESSION_ESTIMATE[profile.goal] ?? 300;
  const avgDailyCaloriesBurned = Math.round(
    (burnPerSession * trainingDays.length) / 7,
  );

  res.json({
    trainingDays,
    avgDailyCaloriesBurned,
    goal: profile.goal,
  });
});

function extractTrainingDays(
  planJson: unknown,
  fallbackCount: number,
): string[] {
  if (
    planJson &&
    typeof planJson === "object" &&
    "days" in planJson &&
    Array.isArray((planJson as { days: unknown[] }).days)
  ) {
    const days = (planJson as { days: Array<{ day?: unknown }> }).days;
    const extracted = days
      .map((d) => (typeof d.day === "string" ? d.day : null))
      .filter((d): d is string => d !== null);
    if (extracted.length > 0) return extracted;
  }
  return DAYS_OF_WEEK.slice(1, 1 + fallbackCount).map((d) => d);
}

export default router;
