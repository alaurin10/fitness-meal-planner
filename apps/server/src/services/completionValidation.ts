import {
  addWeeks,
  dayLabelFromDate,
  parseLocalDate,
  type DayLabel,
} from "@platform/shared";

/**
 * Pure validation/derivation logic for completion endpoints, extracted so it
 * can be unit-tested without a database. The server derives completion state
 * from the stored plan — client-supplied counts are never trusted.
 */

export function dayLabelForDayKey(dayKey: string): DayLabel {
  return dayLabelFromDate(parseLocalDate(dayKey));
}

/**
 * A dayKey belongs to a plan when its calendar date falls inside
 * [weekStartDate, weekStartDate + 7 days). Both sides are local-midnight
 * dates parsed the same way, so the comparison is purely calendar-based.
 */
export function dayKeyInPlanWeek(dayKey: string, weekStartDate: Date): boolean {
  const t = parseLocalDate(dayKey).getTime();
  return (
    t >= weekStartDate.getTime() && t < addWeeks(weekStartDate, 1).getTime()
  );
}

export type MealCompletionResult =
  | { ok: true; indices: number[]; completedAt: Date | null }
  | { ok: false; error: string };

/**
 * Validate a meal-completion payload against the plan and compute the
 * canonical state to persist:
 * - indices are deduped, sorted, and bounds-checked against the day's meals
 * - completedAt is derived server-side; an already-complete day keeps its
 *   original timestamp instead of churning on every re-PUT
 */
export function validateMealCompletion(params: {
  dayKey: string;
  weekStartDate: Date;
  mealCount: number;
  indices: number[];
  previousCompletedAt: Date | null;
}): MealCompletionResult {
  const { dayKey, weekStartDate, mealCount, indices, previousCompletedAt } =
    params;

  if (!dayKeyInPlanWeek(dayKey, weekStartDate)) {
    return { ok: false, error: "dayKey is outside the plan's week" };
  }

  const unique = [...new Set(indices)].sort((a, b) => a - b);
  if (unique.some((idx) => idx >= mealCount)) {
    return { ok: false, error: "Meal index out of range for that day" };
  }

  const complete = mealCount > 0 && unique.length >= mealCount;
  const completedAt = complete ? (previousCompletedAt ?? new Date()) : null;
  return { ok: true, indices: unique, completedAt };
}
