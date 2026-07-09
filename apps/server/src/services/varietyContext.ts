import { prisma } from "@platform/db";
import { addWeeks, type DayLabel } from "@platform/shared";
import type { MealPlanJson } from "./mealPlanSchema.js";
import { normalizeMealPlan } from "./mealPlanNormalizer.js";

/**
 * Variety context: how aggressively new weeks avoid repeating recent meals.
 * The weekly prompt historically had no memory at all, which is why users
 * saw near-identical plans week after week.
 */

export type VarietyStrength = "low" | "medium" | "high";

export interface VarietyParams {
  /** How many prior weeks of plans feed the avoid list. */
  weeksBack: number;
  /** Max recent meal names injected into the prompt. */
  nameCap: number;
  /** Gemini sampling temperature (before the GEMINI_TEMPERATURE env override). */
  temperature: number;
  /** Prompt wording intensity. */
  promptTone: "soft" | "strict";
}

const PARAMS: Record<VarietyStrength, VarietyParams> = {
  low: { weeksBack: 1, nameCap: 20, temperature: 0.7, promptTone: "soft" },
  medium: { weeksBack: 2, nameCap: 40, temperature: 0.9, promptTone: "soft" },
  high: { weeksBack: 3, nameCap: 60, temperature: 1.0, promptTone: "strict" },
};

export function varietyParams(strength: string | null | undefined): VarietyParams {
  if (strength === "low" || strength === "medium" || strength === "high") {
    return PARAMS[strength];
  }
  return PARAMS.medium;
}

/**
 * Meal names from prior plans, newest first, for the prompt's avoid list.
 * Leftover entries are skipped (they duplicate their source meal's name);
 * names are deduped case-insensitively and capped.
 */
export function extractRecentMealNames(plans: MealPlanJson[], cap: number): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const plan of plans) {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        if (meal.isLeftover) continue;
        const name = meal.name.trim();
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
 * Names of every other non-leftover meal in the current week — used to widen
 * `avoidNames` on single-slot regeneration so a "new" meal can't just clone
 * Thursday's dinner.
 */
export function collectWeekAvoidNames(
  plan: MealPlanJson,
  exclude: { day: DayLabel; index: number },
  cap = 30,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const day of plan.days) {
    day.meals.forEach((meal, index) => {
      if (day.day === exclude.day && index === exclude.index) return;
      if (meal.isLeftover) return;
      const name = meal.name.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      if (names.length < cap) names.push(name);
    });
  }
  return names;
}

/**
 * Fetch the newest plan JSON per week for the `weeksBack` weeks before
 * `beforeWeekStart`, newest week first. Past weeks are pruned when new plans
 * generate, so this often returns fewer weeks than asked — that's fine, the
 * variety block simply shrinks.
 */
export async function fetchRecentPlanJsons(
  userId: string,
  beforeWeekStart: Date,
  weeksBack: number,
): Promise<MealPlanJson[]> {
  if (weeksBack <= 0) return [];
  const rows = await prisma.weeklyMealPlan.findMany({
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
  return [...byWeek.values()].map((row) => normalizeMealPlan(row.planJson));
}
