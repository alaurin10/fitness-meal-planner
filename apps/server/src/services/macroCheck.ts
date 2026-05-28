import type { MealPlanJson } from "./mealPlanSchema.js";

/**
 * Post-generation macro verification. The Zod schema guarantees a plan is
 * *structurally* valid, but not that the meals actually add up to the user's
 * calorie/protein goals — the core promise of the app. This computes each day's
 * totals from its meals and flags days that miss the targets so the caller can
 * run a single bounded corrective regeneration.
 */

// Tolerances are env-tunable. A day is flagged if its calories are off by more
// than the calorie tolerance OR its protein is short by more than the protein
// tolerance (excess protein is fine).
const CALORIE_TOLERANCE_PCT = clampPct(Number(process.env.GEMINI_MACRO_CALORIE_TOLERANCE_PCT), 12);
const PROTEIN_UNDER_TOLERANCE_PCT = clampPct(Number(process.env.GEMINI_MACRO_PROTEIN_TOLERANCE_PCT), 15);

function clampPct(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(100, value);
}

export interface DayMacroDeviation {
  day: string;
  calories: number;
  targetCalories: number;
  proteinG: number;
  targetProteinG: number | null;
  /** Signed: positive = over target, negative = under. */
  calorieOffPct: number;
  /** Positive = short of protein target (0 if at/over or no target). */
  proteinUnderPct: number;
  needsFix: boolean;
}

export interface MacroReport {
  deviations: DayMacroDeviation[];
  daysNeedingFix: string[];
}

function sumDay(meals: MealPlanJson["days"][number]["meals"]) {
  return meals.reduce(
    (acc, m) => {
      acc.calories += m.calories ?? 0;
      acc.proteinG += m.proteinG ?? 0;
      return acc;
    },
    { calories: 0, proteinG: 0 },
  );
}

export function evaluateMacros(
  plan: MealPlanJson,
  opts: { proteinTargetG?: number | null },
): MacroReport {
  const targetCalories = plan.dailyCalorieTarget || 0;
  const targetProteinG = opts.proteinTargetG ?? null;

  const deviations: DayMacroDeviation[] = plan.days.map((day) => {
    const { calories, proteinG } = sumDay(day.meals);

    const calorieOffPct = targetCalories > 0 ? ((calories - targetCalories) / targetCalories) * 100 : 0;
    const proteinUnderPct =
      targetProteinG && targetProteinG > 0
        ? Math.max(0, ((targetProteinG - proteinG) / targetProteinG) * 100)
        : 0;

    const calorieMiss = targetCalories > 0 && Math.abs(calorieOffPct) > CALORIE_TOLERANCE_PCT;
    const proteinMiss = proteinUnderPct > PROTEIN_UNDER_TOLERANCE_PCT;

    return {
      day: day.day,
      calories,
      targetCalories,
      proteinG,
      targetProteinG,
      calorieOffPct: Math.round(calorieOffPct),
      proteinUnderPct: Math.round(proteinUnderPct),
      needsFix: calorieMiss || proteinMiss,
    };
  });

  return {
    deviations,
    daysNeedingFix: deviations.filter((d) => d.needsFix).map((d) => d.day),
  };
}

/**
 * Build concrete, per-day feedback to steer a corrective regeneration toward
 * the targets (e.g. "Tue is 1700 kcal (target 2300, ~600 under); ...").
 */
export function buildMacroFeedback(report: MacroReport, days: string[]): string {
  const set = new Set(days);
  const parts = report.deviations
    .filter((d) => set.has(d.day))
    .map((d) => {
      const calDelta = d.targetCalories - d.calories;
      const calNote =
        d.targetCalories > 0
          ? `${d.day} totals ${d.calories} kcal vs target ${d.targetCalories} (${calDelta >= 0 ? `${calDelta} under` : `${-calDelta} over`})`
          : `${d.day} totals ${d.calories} kcal`;
      const proteinNote =
        d.targetProteinG && d.proteinUnderPct > 0
          ? `; protein ${d.proteinG}g vs target ${d.targetProteinG}g (short)`
          : "";
      return `${calNote}${proteinNote}`;
    });

  return [
    "MACRO CORRECTION: the previous draft missed the daily targets on these days. Regenerate them so each day's meals SUM to within ~10% of the calorie target and meet or exceed the protein target.",
    ...parts.map((p) => `- ${p}`),
  ].join("\n");
}
