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

/** Minimum spacing between real Garmin calls per user in watch-session polling. */
export const WATCH_CHECK_MIN_INTERVAL_MS = 60_000;
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
 * Never invents completions beyond the plan's shape: extra sets are absorbed
 * and capped, unknown movements count as unmatched.
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

  // Pass 2: greedy taxonomy matching for freeform sessions (or an unusable
  // step-index hint). Category buckets are order-independent; a plan-order
  // cursor is only a tiebreak, so supersets and reordered exercises still land.
  const expected = exercises.map((ex) =>
    isCardio(ex) ? null : mapExerciseToGarmin(ex.name),
  );
  const counts = new Map<number, number>();
  let cursor = 0;
  let unmatchedSets = 0;

  for (const set of active) {
    let candidates: number[];
    if (isCardioLikeSet(set)) {
      candidates = exercises.flatMap((ex, i) => (isCardio(ex) ? [i] : []));
    } else if (set.category != null) {
      candidates = exercises.flatMap((ex, i) =>
        !isCardio(ex) && expected[i]?.category === set.category ? [i] : [],
      );
    } else {
      // Garmin couldn't identify the movement — only pair it with plan
      // exercises we couldn't map to the taxonomy either.
      candidates = exercises.flatMap((ex, i) =>
        !isCardio(ex) && expected[i] != null && expected[i]!.category == null ? [i] : [],
      );
    }
    if (candidates.length === 0) {
      unmatchedSets += 1;
      continue;
    }

    const available = candidates.filter((i) => (counts.get(i) ?? 0) < Math.max(1, exercises[i]!.sets));
    const nameMatches = (i: number) =>
      set.name != null && expected[i] != null && expected[i]!.name === set.name;
    const pickFrom = (pool: number[]): number | null => {
      if (pool.length === 0) return null;
      const ahead = pool.filter((i) => i >= cursor);
      const ordered = ahead.length > 0 ? ahead : pool;
      return ordered.find(nameMatches) ?? ordered[0]!;
    };
    // All candidates full: an extra set beyond the plan — absorb it on the
    // last matching exercise; the cap below keeps delta within plan shape.
    const pick = pickFrom(available) ?? candidates[candidates.length - 1]!;
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    cursor = Math.max(cursor, pick);
  }

  const delta: SetsJson = {};
  let matchedSets = 0;
  for (const [idx, count] of counts) {
    const capped = Math.min(count, Math.max(1, exercises[idx]!.sets));
    delta[String(idx)] = Array.from({ length: capped }, (_, n) => n + 1);
    matchedSets += capped;
  }
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
  | { status: "waiting"; madeGarminCall: boolean }
  | {
      status: "found";
      madeGarminCall: boolean;
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

// Per-user floor between real Garmin calls, so aggressive client polling can
// never hammer Garmin. In-memory is fine — the same single-instance assumption
// the rateLimit middleware makes.
const lastWatchChecks = new Map<string, { at: number; result: WatchSessionCheck }>();

/** Test hook: clear the per-user watch-check throttle. */
export function resetWatchCheckThrottle(): void {
  lastWatchChecks.clear();
}

/**
 * One poll of the "doing this on my watch" live session: look for a saved
 * strength activity on the given day and, when it appears, run set sync-back
 * and return the merged completion. Returns null when the plan isn't the
 * caller's. Throttled to one real Garmin call per user per minute.
 */
export async function checkWatchSession(
  userId: string,
  api: GarminApi,
  input: { planId: string; dayKey: string },
  now = new Date(),
): Promise<WatchSessionCheck | null> {
  const plan = await prisma.weeklyPlan.findFirst({ where: { id: input.planId, userId } });
  if (!plan) return null;

  const recent = lastWatchChecks.get(userId);
  if (recent && now.getTime() - recent.at < WATCH_CHECK_MIN_INTERVAL_MS) {
    return { ...recent.result, madeGarminCall: false };
  }

  const activities = await api.getActivities(0, WATCH_CHECK_ACTIVITY_PAGE);
  const match = activities.find(
    (a) => a.typeKey === "strength_training" && a.startTimeLocal.slice(0, 10) === input.dayKey,
  );

  let result: WatchSessionCheck;
  if (!match) {
    result = { status: "waiting", madeGarminCall: true };
  } else {
    // Record the activity immediately (the routine sync may not have run yet),
    // then consume its sets. Re-running past a setsSyncedAt stamp is safe —
    // the merge is a union — and catches set data finalized after the summary.
    await upsertActivityLog(userId, match);
    const synced = await syncActivitySets(userId, api, match);
    if (synced.status === "synced") {
      result = {
        status: "found",
        madeGarminCall: true,
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
    } else {
      // Activity exists but sets aren't consumable yet — keep waiting.
      result = { status: "waiting", madeGarminCall: true };
    }
  }

  lastWatchChecks.set(userId, { at: now.getTime(), result });
  return result;
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
