import { prisma } from "@platform/db";
import { parseLocalDate, startOfWeek, type WeekStartDay } from "@platform/shared";
import { findWorkoutPlanForWeek } from "../activePlan.js";
import { weeklyPlanSchema } from "../workoutPlanSchema.js";
import {
  dayLabelForDayKey,
  upsertMergedCompletion,
  type SetsJson,
} from "../workoutCompletion.js";
import { mapExerciseToGarmin } from "./workoutPush.js";
import { mapGarminActivity } from "./sync.js";
import type { GarminActivitySummary, GarminApi, GarminExerciseSet } from "./types.js";

// Watch-led completion sync-back: after the user runs a workout on their
// Garmin watch, the saved activity's per-set data is mapped back onto that
// day's plan exercises and merged into WorkoutCompletion.setsJson — the same
// store the phone walkthrough writes — so the app reflects what was done on
// the watch without any phone interaction during the workout.

const WATCH_CHECK_ACTIVITY_PAGE = 5;

export interface MatchExercise {
  name: string;
  sets: number;
  type?: string | null;
  durationMinutes?: number | null;
}

export interface MatchResult {
  delta: SetsJson;
  matchedSets: number;
  unmatchedSets: number;
}

function isCardio(ex: MatchExercise): boolean {
  return ex.type === "cardio" && ex.durationMinutes != null && ex.durationMinutes > 0;
}

function isCardioLikeSet(set: GarminExerciseSet): boolean {
  return set.category === "CARDIO" || (set.reps == null && (set.durationSeconds ?? 0) > 0);
}

interface StepSlot {
  kind: "interval" | "rest";
  exerciseIdx: number;
  setNum: number;
}

/**
 * Rebuild the flat workout-service step list the push produced (see
 * buildWorkoutServicePayload): cardio = one interval step with no rest;
 * strength = one interval step per set, each followed by a rest step except
 * the final set of the last exercise when that exercise is a strength one.
 */
function buildStepSlots(exercises: MatchExercise[]): StepSlot[] {
  const slots: StepSlot[] = [];
  exercises.forEach((ex, exerciseIdx) => {
    if (isCardio(ex)) {
      slots.push({ kind: "interval", exerciseIdx, setNum: 1 });
      return;
    }
    const sets = Math.max(1, ex.sets);
    for (let setNum = 1; setNum <= sets; setNum++) {
      slots.push({ kind: "interval", exerciseIdx, setNum });
      const isLastSetOfLastExercise = exerciseIdx === exercises.length - 1 && setNum === sets;
      if (!isLastSetOfLastExercise) slots.push({ kind: "rest", exerciseIdx, setNum });
    }
  });
  return slots;
}

/**
 * Pass 1: when every recorded set carries a wkStepIndex (the user launched the
 * pushed workout on the watch), map sets straight back to (exercise, set)
 * positions. The index basis is undocumented, so probe plausible
 * interpretations and accept one only when it lands ≥80% of sets on interval
 * steps; otherwise the caller falls back to taxonomy matching.
 */
function matchByStepIndex(exercises: MatchExercise[], active: GarminExerciseSet[]): MatchResult | null {
  if (active.length === 0 || active.some((s) => s.wkStepIndex == null)) return null;

  const slots = buildStepSlots(exercises);
  const activeSlots = slots.filter((s) => s.kind === "interval");
  const mappings: ((idx: number) => StepSlot | undefined)[] = [
    (idx) => slots[idx], // 0-based over all steps
    (idx) => slots[idx - 1], // 1-based over all steps
    (idx) => activeSlots[idx], // 0-based over interval steps only
    (idx) => activeSlots[idx - 1], // 1-based over interval steps only
  ];

  let best: { map: (idx: number) => StepSlot | undefined; score: number } | null = null;
  for (const map of mappings) {
    const hits = active.filter((s) => map(s.wkStepIndex!)?.kind === "interval").length;
    const score = hits / active.length;
    if (!best || score > best.score) best = { map, score };
  }
  if (!best || best.score < 0.8) return null;

  const delta: SetsJson = {};
  let matchedSets = 0;
  let unmatchedSets = 0;
  for (const set of active) {
    const slot = best.map(set.wkStepIndex!);
    if (slot?.kind !== "interval") {
      unmatchedSets += 1;
      continue;
    }
    const key = String(slot.exerciseIdx);
    const existing = delta[key] ?? [];
    if (!existing.includes(slot.setNum)) {
      delta[key] = [...existing, slot.setNum].sort((a, b) => a - b);
      matchedSets += 1;
    }
  }
  return { delta, matchedSets, unmatchedSets };
}

/**
 * Map a strength activity's recorded sets onto the day's plan exercises.
 * Primary path is the exact wkStepIndex mapping (Pass 1); otherwise an
 * order-first alignment (Pass 2) that follows plan order — robust to Garmin
 * relabeling names/categories, which the push taxonomy can never fully cover.
 * Never invents completions beyond the plan's shape: each exercise is capped
 * at its planned set count; sets with nowhere to go count as unmatched.
 */
export function matchGarminSetsToPlan(
  exercises: MatchExercise[],
  garminSets: GarminExerciseSet[],
): MatchResult {
  const active = garminSets
    .filter((s) => s.setType === "ACTIVE" && ((s.reps ?? 0) > 0 || (s.durationSeconds ?? 0) > 0))
    .sort((a, b) => {
      if (a.startTimeGMT == null || b.startTimeGMT == null) return 0;
      return a.startTimeGMT < b.startTimeGMT ? -1 : a.startTimeGMT > b.startTimeGMT ? 1 : 0;
    });

  const byStepIndex = matchByStepIndex(exercises, active);
  if (byStepIndex) return byStepIndex;

  // Pass 2: order-first alignment. A pushed workout is executed in plan order
  // on the watch, and the Garmin activity preserves that order as contiguous
  // blocks — the reliable signal. So walk sets in time order behind a cursor
  // over the plan, letting each exercise absorb its run of sets. Category is
  // only a soft correction: it decides when a set clearly belongs to a
  // *later* exercise (skip-ahead), never a hard gate. This is what makes an
  // unmapped plan exercise (expected null) or a Garmin-relabeled set still
  // land where it belongs — the case the taxonomy can never fully cover.
  const expected = exercises.map((ex) => (isCardio(ex) ? null : mapExerciseToGarmin(ex.name)));
  const planned = exercises.map((ex) => Math.max(1, ex.sets));
  const counts = exercises.map(() => 0);
  const open = (i: number) => !isCardio(exercises[i]!) && counts[i]! < planned[i]!;
  const full = (i: number) => !isCardio(exercises[i]!) && counts[i]! >= planned[i]!;
  // A strength set fits exercise i when categories line up, or either side is a
  // wildcard — an unmapped plan exercise (expected null) or an unidentified
  // "Unknown" rep (set.category null) is assumed to be the current movement.
  const fits = (set: GarminExerciseSet, i: number): boolean => {
    if (isCardio(exercises[i]!)) return false;
    if (expected[i] == null || set.category == null) return true;
    return expected[i]!.category === set.category;
  };
  // A confident, specific category match (both sides mapped and equal) — the
  // signal for a clean exercise transition or an out-of-order finish.
  const strictCat = (set: GarminExerciseSet, i: number): boolean =>
    !isCardio(exercises[i]!) &&
    set.category != null &&
    expected[i]?.category != null &&
    expected[i]!.category === set.category;

  const bump = (i: number) => {
    counts[i] = (counts[i] ?? 0) + 1;
  };
  let cursor = 0;
  let unmatchedSets = 0;

  for (const set of active) {
    // Cardio blocks match a cardio plan exercise regardless of cursor position.
    if (isCardioLikeSet(set)) {
      const j = exercises.findIndex((ex, i) => isCardio(ex) && counts[i]! < planned[i]!);
      if (j === -1) unmatchedSets += 1;
      else bump(j);
      continue;
    }

    // Advance to the next open strength exercise.
    while (cursor < exercises.length && !open(cursor)) cursor += 1;

    if (cursor >= exercises.length) {
      // Everything ahead is full/cardio. A set that strictly matches some
      // not-full exercise (an out-of-order finish) still lands; else extra.
      const j = exercises.findIndex((_ex, i) => open(i) && strictCat(set, i));
      if (j === -1) unmatchedSets += 1;
      else bump(j);
      continue;
    }

    if (fits(set, cursor)) {
      bump(cursor);
      continue;
    }

    // The set's category differs from the current exercise. Prefer a later
    // exercise it strictly matches (a clean transition past skipped work).
    const later = exercises.findIndex((_ex, i) => i > cursor && open(i) && strictCat(set, i));
    if (later !== -1) {
      cursor = later;
      bump(cursor);
      continue;
    }

    // No forward home. If it strictly matches an already-completed exercise
    // it's a genuine extra rep of a finished movement (report it, don't spill
    // into the next exercise); otherwise it's a Garmin-relabeled set of the
    // current movement — absorb it in order, which is the reliable signal.
    if (exercises.some((_ex, i) => full(i) && strictCat(set, i))) unmatchedSets += 1;
    else bump(cursor);
  }

  const delta: SetsJson = {};
  let matchedSets = 0;
  counts.forEach((count, idx) => {
    if (count <= 0) return;
    delta[String(idx)] = Array.from({ length: count }, (_, n) => n + 1);
    matchedSets += count;
  });
  return { delta, matchedSets, unmatchedSets };
}

export interface ResolvedPlanDay {
  planId: string;
  dayKey: string;
  exercises: MatchExercise[];
}

/**
 * Find the plan day a Garmin activity belongs to. Uses the activity's
 * watch-local start date (matching the app's local-dayKey completion
 * convention) and the week's newest plan — same resolution the phone uses.
 */
export async function resolvePlanDayForActivity(
  userId: string,
  startTimeLocal: string,
): Promise<ResolvedPlanDay | null> {
  const dayKey = startTimeLocal.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const weekStartDay = (settings?.weekStartDay ?? "Mon") as WeekStartDay;
  const plan = await findWorkoutPlanForWeek(userId, startOfWeek(parseLocalDate(dayKey), weekStartDay));
  if (!plan) return null;

  const validated = weeklyPlanSchema.safeParse(plan.planJson);
  if (!validated.success) return null;
  const dayEntry = validated.data.days.find((d) => d.day === dayLabelForDayKey(dayKey));
  if (!dayEntry) return null;

  return { planId: plan.id, dayKey, exercises: dayEntry.exercises };
}

export type SyncActivitySetsResult =
  | {
      status: "synced";
      planId: string;
      dayKey: string;
      matchedSets: number;
      totalPlannedSets: number;
      unmatchedSets: number;
      completion: { setsJson: unknown; completedAt: Date | null };
    }
  | { status: "skipped"; reason: "no_plan_day" | "no_sets" };

async function stampSetsSynced(userId: string, externalId: string): Promise<void> {
  await prisma.activityLog
    .update({
      where: { userId_source_externalId: { userId, source: "garmin", externalId } },
      data: { setsSyncedAt: new Date() },
    })
    .catch(() => {}); // row may not exist yet for edge orderings; next sync re-runs
}

/**
 * Consume one Garmin strength activity: fetch its recorded sets, map them
 * onto the day's plan, and merge into the completion row. Idempotent — the
 * merge is a set union and re-processing is stamped via ActivityLog.setsSyncedAt.
 */
export async function syncActivitySets(
  userId: string,
  api: GarminApi,
  activity: { activityId: number | string; startTimeLocal: string },
): Promise<SyncActivitySetsResult> {
  const externalId = String(activity.activityId);
  const resolved = await resolvePlanDayForActivity(userId, activity.startTimeLocal);
  if (!resolved) {
    // No plan / rest day: consume the activity so routine syncs stop retrying.
    await stampSetsSynced(userId, externalId);
    return { status: "skipped", reason: "no_plan_day" };
  }

  const garminSets = await api.getActivityExerciseSets(externalId);
  if (garminSets.length === 0) {
    // Leave unstamped: Garmin sometimes finalizes set data after the activity
    // summary appears, so the next sync should retry this one.
    return { status: "skipped", reason: "no_sets" };
  }

  const { delta, matchedSets, unmatchedSets } = matchGarminSetsToPlan(resolved.exercises, garminSets);
  const completion = await upsertMergedCompletion(
    userId,
    resolved.planId,
    resolved.dayKey,
    delta,
    resolved.exercises,
  );
  await stampSetsSynced(userId, externalId);

  return {
    status: "synced",
    planId: resolved.planId,
    dayKey: resolved.dayKey,
    matchedSets,
    totalPlannedSets: resolved.exercises.reduce((s, ex) => s + Math.max(1, ex.sets), 0),
    unmatchedSets,
    completion: { setsJson: completion.setsJson, completedAt: completion.completedAt },
  };
}

export type WatchSessionCheck =
  | { status: "waiting" }
  | {
      status: "found";
      activity: {
        activityId: string;
        activityName: string;
        durationMinutes: number | null;
        calories: number | null;
      };
      matchedSets: number;
      totalPlannedSets: number;
      unmatchedSets: number;
      completion: { setsJson: unknown; completedAt: Date | null };
    };

/**
 * The "doing this on my watch" Finish check: look for a saved strength
 * activity on the given day and, when it appears, run set sync-back and
 * return the merged completion. Returns null when the plan isn't the
 * caller's. Called once per deliberate Finish tap (rate-limited at the route),
 * so each call does one honest Garmin lookup.
 */
export async function checkWatchSession(
  userId: string,
  api: GarminApi,
  input: { planId: string; dayKey: string },
): Promise<WatchSessionCheck | null> {
  const plan = await prisma.weeklyPlan.findFirst({ where: { id: input.planId, userId } });
  if (!plan) return null;

  const activities = await api.getActivities(0, WATCH_CHECK_ACTIVITY_PAGE);
  const match = activities.find(
    (a) => a.typeKey === "strength_training" && a.startTimeLocal.slice(0, 10) === input.dayKey,
  );
  if (!match) return { status: "waiting" };

  // Record the activity immediately (the routine sync may not have run yet),
  // then consume its sets. Re-running past a setsSyncedAt stamp is safe —
  // the merge is a union — and catches set data finalized after the summary.
  await upsertActivityLog(userId, match);
  const synced = await syncActivitySets(userId, api, match);
  if (synced.status !== "synced") {
    // Activity exists but sets aren't consumable yet — keep waiting.
    return { status: "waiting" };
  }

  return {
    status: "found",
    activity: {
      activityId: String(match.activityId),
      activityName: match.activityName,
      durationMinutes:
        match.durationSeconds != null && match.durationSeconds > 0
          ? Math.max(1, Math.round(match.durationSeconds / 60))
          : null,
      calories: match.calories != null ? Math.round(match.calories) : null,
    },
    matchedSets: synced.matchedSets,
    totalPlannedSets: synced.totalPlannedSets,
    unmatchedSets: synced.unmatchedSets,
    completion: synced.completion,
  };
}

async function upsertActivityLog(userId: string, activity: GarminActivitySummary): Promise<void> {
  const m = mapGarminActivity(activity);
  await prisma.activityLog.upsert({
    where: { userId_source_externalId: { userId, source: "garmin", externalId: m.externalId } },
    update: {
      activityName: m.activityName,
      performedAt: m.performedAt,
      durationMinutes: m.durationMinutes,
      activeCalories: m.activeCalories,
      distanceMiles: m.distanceMiles,
    },
    create: { userId, source: "garmin", ...m },
  });
}
