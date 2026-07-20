import { prisma } from "@platform/db";
import { ALL_DAYS, type DayLabel } from "@platform/shared";

// Shared set-completion logic used by the phone walkthrough's PUT
// /api/workouts/completions route (replace semantics) and the Garmin
// watch sync-back (merge semantics). Both write the same
// WorkoutCompletion.setsJson shape: Record<exerciseIdx, completedSetNumbers[]>.

/** Minimal view of a plan exercise the completion logic needs. */
export interface CompletionExercise {
  sets: number;
}

export type SetsJson = Record<string, number[]>;

/** Day-of-week label for a YYYY-MM-DD local dayKey. */
export function dayLabelForDayKey(dayKey: string): DayLabel {
  const date = new Date(dayKey + "T12:00:00");
  return ALL_DAYS[(date.getDay() + 6) % 7]!;
}

/**
 * Drop keys that don't map to an exercise on the day and clamp set numbers to
 * the exercise's planned range, so stored completions never reference slots
 * outside the plan. Dedupes and sorts each exercise's set list.
 */
export function sanitizeSetsJson(setsJson: SetsJson, exercises: CompletionExercise[]): SetsJson {
  const out: SetsJson = {};
  for (const [key, sets] of Object.entries(setsJson)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= exercises.length) continue;
    const max = exercises[idx]!.sets;
    const valid = Array.from(
      new Set(sets.filter((n) => Number.isInteger(n) && n >= 1 && n <= max)),
    ).sort((a, b) => a - b);
    if (valid.length > 0) out[key] = valid;
  }
  return out;
}

/** True when every exercise has at least its planned number of sets marked. */
export function isAllDone(setsJson: SetsJson, exercises: CompletionExercise[]): boolean {
  return exercises.every((ex, idx) => (setsJson[String(idx)] ?? []).length >= ex.sets);
}

/** Per-exercise union of completed set numbers, sorted. Pure and idempotent. */
export function mergeSetsJson(base: SetsJson, delta: SetsJson): SetsJson {
  const out: SetsJson = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(delta)])) {
    const merged = Array.from(new Set([...(base[key] ?? []), ...(delta[key] ?? [])])).sort(
      (a, b) => a - b,
    );
    if (merged.length > 0) out[key] = merged;
  }
  return out;
}

/**
 * Merge `delta` into the user's existing completion row for the day (creating
 * it if absent). Never removes already-marked sets, so watch-derived and
 * phone-marked completions coexist. Preserves an existing completedAt
 * timestamp; stamps one when the merge finishes the day.
 */
export async function upsertMergedCompletion(
  userId: string,
  planId: string,
  dayKey: string,
  delta: SetsJson,
  exercises: CompletionExercise[],
) {
  const existing = await prisma.workoutCompletion.findUnique({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
  });
  const base = (existing?.setsJson ?? {}) as SetsJson;
  const setsJson = sanitizeSetsJson(mergeSetsJson(base, delta), exercises);
  const completedAt = isAllDone(setsJson, exercises)
    ? (existing?.completedAt ?? new Date())
    : (existing?.completedAt ?? null);
  return prisma.workoutCompletion.upsert({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
    update: { setsJson, completedAt },
    create: { userId, planId, dayKey, setsJson, completedAt },
  });
}
