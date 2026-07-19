import { prisma } from "@platform/db";
import { addWeeks } from "@platform/shared";
import { weeklyPlanSchema, type WeeklyPlanJson } from "./workoutPlanSchema.js";

/**
 * Workout variety context: how aggressively new weeks rotate exercise
 * selection. Mirrors the meal-side varietyContext — the weekly prompt only
 * ever saw the previous week's plan, which is why accessory work repeated
 * near-identically week after week.
 *
 * Strength → weeksBack/nameCap/temperature/promptTone mapping is shared with
 * meals via varietyParams in varietyContext.ts.
 */

/**
 * Exercise names from prior plans, newest first, for the prompt's
 * recently-prescribed list. Deduped case-insensitively and capped. Baseline
 * (anchor) lifts are NOT filtered here — the prompt explicitly exempts them
 * from rotation so progression carries forward.
 */
export function extractRecentExerciseNames(plans: WeeklyPlanJson[], cap: number): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const plan of plans) {
    for (const day of plan.days) {
      for (const exercise of day.exercises) {
        const name = exercise.name.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
        if (names.length >= cap) return names;
      }
    }
  }
  return names;
}

/**
 * Fetch the newest workout plan JSON per week for the `weeksBack` weeks before
 * `beforeWeekStart`, newest week first. Rows that fail schema validation
 * (ancient/malformed blobs) are skipped — the variety list simply shrinks.
 */
export async function fetchRecentWorkoutPlanJsons(
  userId: string,
  beforeWeekStart: Date,
  weeksBack: number,
): Promise<WeeklyPlanJson[]> {
  if (weeksBack <= 0) return [];
  const rows = await prisma.weeklyPlan.findMany({
    where: {
      userId,
      weekStartDate: { gte: addWeeks(beforeWeekStart, -weeksBack), lt: beforeWeekStart },
    },
    orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
  });
  // Newest row per week wins (deactivated + replacement rows share a week).
  const byWeek = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.weekStartDate.getTime();
    if (!byWeek.has(key)) byWeek.set(key, row);
  }
  const plans: WeeklyPlanJson[] = [];
  for (const row of byWeek.values()) {
    const parsed = weeklyPlanSchema.safeParse(row.planJson);
    if (parsed.success) plans.push(parsed.data);
  }
  return plans;
}
