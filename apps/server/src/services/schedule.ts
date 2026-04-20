import { prisma } from "@platform/db";

export interface TrainingSchedule {
  trainingDays: string[];
  avgDailyCaloriesBurned: number;
  goal: string | null;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const CALORIE_PER_SESSION_ESTIMATE: Record<string, number> = {
  build_muscle: 350,
  lose_fat: 450,
  maintain: 300,
};

export async function getTrainingSchedule(userId: string): Promise<TrainingSchedule> {
  const [profile, plan] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.weeklyPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) {
    return { trainingDays: [], avgDailyCaloriesBurned: 0, goal: null };
  }

  const trainingDays = extractTrainingDays(plan?.planJson, profile.trainingDaysPerWeek);
  const burnPerSession = CALORIE_PER_SESSION_ESTIMATE[profile.goal] ?? 300;
  const avgDailyCaloriesBurned = Math.round(
    (burnPerSession * trainingDays.length) / 7,
  );

  return {
    trainingDays,
    avgDailyCaloriesBurned,
    goal: profile.goal,
  };
}

function extractTrainingDays(planJson: unknown, fallbackCount: number): string[] {
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
