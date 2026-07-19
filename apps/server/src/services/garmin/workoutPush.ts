import { prisma } from "@platform/db";
import {
  localDayKey,
  normalizeExerciseName,
  rotateDays,
  type WeekStartDay,
} from "@platform/shared";
import type { GarminApi, GarminWorkoutPayload, GarminWorkoutStep } from "./types.js";

// Converts the app's AI-generated weekly strength plan into Garmin structured
// workouts (workout-service format) and schedules them on the Garmin calendar
// so they show up on the watch. This is the most fragile surface of the
// unofficial API: every payload detail here mirrors what the Garmin Connect
// web workout builder sends.

const LBS_PER_KG = 2.2046226218;
const DEFAULT_REPS = 10;
const ESTIMATED_SECONDS_PER_SET = 40;

interface PlanExercise {
  name: string;
  sets: number;
  reps?: string | null;
  loadLbs?: number | null;
  restSeconds?: number | null;
  type?: string | null;
  durationMinutes?: number | null;
}

interface PlanDay {
  day: string;
  focus?: string;
  exercises?: PlanExercise[];
}

// Garmin FIT exercise taxonomy. Categories are reliable; specific names are
// only set where we're confident — a wrong pair makes Garmin reject the
// workout, while a null name still renders the step (with our description).
const EXERCISE_TAXONOMY: Record<string, { category: string; name: string | null }> = {
  "bench press": { category: "BENCH_PRESS", name: "BARBELL_BENCH_PRESS" },
  "incline bench press": { category: "BENCH_PRESS", name: "INCLINE_BARBELL_BENCH_PRESS" },
  "incline press": { category: "BENCH_PRESS", name: null },
  "chest press": { category: "BENCH_PRESS", name: null },
  "squat": { category: "SQUAT", name: "BARBELL_BACK_SQUAT" },
  "back squat": { category: "SQUAT", name: "BARBELL_BACK_SQUAT" },
  "front squat": { category: "SQUAT", name: "BARBELL_FRONT_SQUAT" },
  "goblet squat": { category: "SQUAT", name: "GOBLET_SQUAT" },
  "split squat": { category: "SQUAT", name: null },
  "bulgarian split squat": { category: "SQUAT", name: null },
  "deadlift": { category: "DEADLIFT", name: "BARBELL_DEADLIFT" },
  "romanian deadlift": { category: "DEADLIFT", name: "ROMANIAN_DEADLIFT" },
  "rdl": { category: "DEADLIFT", name: "ROMANIAN_DEADLIFT" },
  "sumo deadlift": { category: "DEADLIFT", name: "SUMO_DEADLIFT" },
  "row": { category: "ROW", name: null },
  "bent over row": { category: "ROW", name: null },
  "seated row": { category: "ROW", name: "SEATED_CABLE_ROW" },
  "lat pulldown": { category: "PULL_UP", name: "LAT_PULLDOWN" },
  "pull up": { category: "PULL_UP", name: "PULL_UP" },
  "pullup": { category: "PULL_UP", name: "PULL_UP" },
  "chin up": { category: "PULL_UP", name: "CHIN_UP" },
  "push up": { category: "PUSH_UP", name: "PUSH_UP" },
  "pushup": { category: "PUSH_UP", name: "PUSH_UP" },
  "overhead press": { category: "SHOULDER_PRESS", name: null },
  "shoulder press": { category: "SHOULDER_PRESS", name: null },
  "military press": { category: "SHOULDER_PRESS", name: null },
  "lateral raise": { category: "LATERAL_RAISE", name: null },
  "curl": { category: "CURL", name: null },
  "bicep curl": { category: "CURL", name: null },
  "biceps curl": { category: "CURL", name: null },
  "hammer curl": { category: "CURL", name: "HAMMER_CURL" },
  "tricep extension": { category: "TRICEPS_EXTENSION", name: null },
  "triceps extension": { category: "TRICEPS_EXTENSION", name: null },
  "skullcrusher": { category: "TRICEPS_EXTENSION", name: null },
  "dip": { category: "TRICEPS_EXTENSION", name: null },
  "lunge": { category: "LUNGE", name: "LUNGE" },
  "walking lunge": { category: "LUNGE", name: "WALKING_LUNGE" },
  "leg press": { category: "LEG_PRESS", name: null },
  "leg curl": { category: "LEG_CURL", name: null },
  "leg extension": { category: "LEG_EXTENSION", name: null },
  "calf raise": { category: "CALF_RAISE", name: null },
  "hip thrust": { category: "HIP_RAISE", name: "BARBELL_HIP_THRUST" },
  "glute bridge": { category: "HIP_RAISE", name: null },
  "plank": { category: "PLANK", name: "PLANK" },
  "crunch": { category: "CRUNCH", name: "CRUNCH" },
  "sit up": { category: "SIT_UP", name: null },
  "russian twist": { category: "CORE", name: null },
  "face pull": { category: "ROW", name: null },
  "shrug": { category: "SHRUG", name: null },
};

export function mapExerciseToGarmin(name: string): { category: string | null; name: string | null } {
  const normalized = normalizeExerciseName(name);
  const hit = EXERCISE_TAXONOMY[normalized];
  if (hit) return hit;
  // Fall back to a substring pass so "Paused Bench Press" still lands in the
  // right category.
  for (const [key, value] of Object.entries(EXERCISE_TAXONOMY)) {
    if (normalized.includes(key)) return value;
  }
  return { category: null, name: null };
}

/** Lower bound of a reps string: "8-10" → 8, "5" → 5, "AMRAP" → default. */
export function parseRepsLowerBound(reps: string | null | undefined): number {
  if (!reps) return DEFAULT_REPS;
  const match = reps.match(/\d+/);
  if (!match) return DEFAULT_REPS;
  const n = Number(match[0]);
  return n > 0 && n <= 100 ? n : DEFAULT_REPS;
}

/** Convert one plan day into the app-level workout payload. */
export function convertPlanDay(day: PlanDay, workoutName: string): GarminWorkoutPayload {
  const steps: GarminWorkoutStep[] = (day.exercises ?? []).map((ex) => {
    if (ex.type === "cardio" && ex.durationMinutes != null && ex.durationMinutes > 0) {
      return {
        exerciseCategory: "CARDIO",
        exerciseName: null,
        description: `${ex.name} — ${ex.durationMinutes} min`,
        reps: 0,
        weightLbs: null,
        restSeconds: 0,
        sets: 1,
        durationSeconds: ex.durationMinutes * 60,
      };
    }
    const taxonomy = mapExerciseToGarmin(ex.name);
    const load = ex.loadLbs != null && ex.loadLbs > 0 ? ex.loadLbs : null;
    return {
      exerciseCategory: taxonomy.category,
      exerciseName: taxonomy.name,
      description: load != null ? `${ex.name} @ ${load} lbs` : ex.name,
      reps: parseRepsLowerBound(ex.reps),
      weightLbs: load,
      restSeconds: ex.restSeconds != null && ex.restSeconds > 0 ? ex.restSeconds : 60,
      sets: Math.max(1, ex.sets),
    };
  });
  return {
    name: workoutName,
    description: day.focus ? `${day.focus} — sent from Fitness Meal Planner` : "Sent from Fitness Meal Planner",
    steps,
  };
}

/**
 * Build the raw workout-service body. Each set becomes an interval step
 * (end condition: reps) followed by a rest step — a flat step list is the
 * most compatible shape for strength workouts.
 */
export function buildWorkoutServicePayload(payload: GarminWorkoutPayload): Record<string, unknown> {
  const sportType = { sportTypeId: 5, sportTypeKey: "strength_training", displayOrder: 5 };
  const workoutSteps: Record<string, unknown>[] = [];
  let stepOrder = 1;

  for (const step of payload.steps) {
    // Cardio block: a single time-ended interval step, no trailing rest.
    if (step.durationSeconds != null && step.durationSeconds > 0) {
      workoutSteps.push({
        type: "ExecutableStepDTO",
        stepId: null,
        stepOrder: stepOrder++,
        childStepId: null,
        description: step.description,
        stepType: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
        endCondition: { conditionTypeId: 2, conditionTypeKey: "time", displayOrder: 2, displayable: true },
        endConditionValue: step.durationSeconds,
        preferredEndConditionUnit: null,
        endConditionCompare: null,
        targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 },
        targetValueOne: null,
        targetValueTwo: null,
        zoneNumber: null,
        category: step.exerciseCategory,
        exerciseName: step.exerciseName,
        weightValue: null,
        weightUnit: null,
      });
      continue;
    }
    const weightKg =
      step.weightLbs != null ? Math.round((step.weightLbs / LBS_PER_KG) * 100) / 100 : null;
    for (let set = 1; set <= step.sets; set++) {
      workoutSteps.push({
        type: "ExecutableStepDTO",
        stepId: null,
        stepOrder: stepOrder++,
        childStepId: null,
        description: step.sets > 1 ? `${step.description} (set ${set}/${step.sets})` : step.description,
        stepType: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
        endCondition: { conditionTypeId: 10, conditionTypeKey: "reps", displayOrder: 10, displayable: true },
        endConditionValue: step.reps,
        preferredEndConditionUnit: null,
        endConditionCompare: null,
        targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 },
        targetValueOne: null,
        targetValueTwo: null,
        zoneNumber: null,
        category: step.exerciseCategory,
        exerciseName: step.exerciseName,
        weightValue: weightKg,
        weightUnit: weightKg != null ? { unitId: 8, unitKey: "kilogram", factor: 1000 } : null,
      });
      const isLastSetOfLastExercise =
        step === payload.steps[payload.steps.length - 1] && set === step.sets;
      if (!isLastSetOfLastExercise) {
        workoutSteps.push({
          type: "ExecutableStepDTO",
          stepId: null,
          stepOrder: stepOrder++,
          childStepId: null,
          description: null,
          stepType: { stepTypeId: 5, stepTypeKey: "rest", displayOrder: 5 },
          endCondition: { conditionTypeId: 8, conditionTypeKey: "fixed.rest", displayOrder: 8, displayable: true },
          endConditionValue: step.restSeconds,
          preferredEndConditionUnit: null,
          endConditionCompare: null,
          targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 },
          targetValueOne: null,
          targetValueTwo: null,
          zoneNumber: null,
        });
      }
    }
  }

  const strengthSteps = payload.steps.filter((s) => !(s.durationSeconds != null && s.durationSeconds > 0));
  const totalSets = strengthSteps.reduce((s, e) => s + e.sets, 0);
  const totalRest = strengthSteps.reduce((s, e) => s + e.sets * e.restSeconds, 0);
  const totalCardio = payload.steps.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);

  return {
    workoutName: payload.name,
    description: payload.description,
    sportType,
    subSportType: null,
    estimatedDurationInSecs: totalSets * ESTIMATED_SECONDS_PER_SET + totalRest + totalCardio,
    estimatedDistanceInMeters: null,
    avgTrainingSpeed: null,
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps }],
  };
}

export interface PushDayResult {
  day: string;
  dayKey: string;
  workoutName: string;
  scheduled: boolean;
  error?: string;
}

/**
 * Push every training day of a weekly plan to Garmin as a scheduled workout.
 * Re-pushing the same plan deletes the previously created Garmin workouts
 * first (ids are remembered inside planJson.garminPush) to avoid duplicates.
 */
export async function pushWeekToGarmin(
  userId: string,
  api: GarminApi,
  plan: { id: string; weekStartDate: Date; planJson: unknown },
): Promise<PushDayResult[]> {
  const planJson = (plan.planJson ?? {}) as {
    days?: PlanDay[];
    garminPush?: { workoutIds?: string[] };
  };
  const days = (planJson.days ?? []).filter((d) => (d.exercises?.length ?? 0) > 0);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const weekStartDay = (settings?.weekStartDay ?? "Mon") as WeekStartDay;
  const orderedDays = rotateDays(weekStartDay);

  // Best-effort cleanup of a previous push of this same plan.
  for (const staleId of planJson.garminPush?.workoutIds ?? []) {
    await api.deleteWorkout(staleId).catch(() => {});
  }

  const results: PushDayResult[] = [];
  const createdIds: string[] = [];
  for (const day of days) {
    const offset = orderedDays.indexOf(day.day as (typeof orderedDays)[number]);
    const date = new Date(plan.weekStartDate);
    date.setDate(date.getDate() + Math.max(0, offset));
    const dayKey = localDayKey(date);
    const workoutName = `${day.focus ?? "Workout"} · ${day.day} (FMP)`;

    try {
      const payload = convertPlanDay(day, workoutName);
      const { workoutId } = await api.createStrengthWorkout(payload);
      createdIds.push(workoutId);
      await api.scheduleWorkout(workoutId, dayKey);
      results.push({ day: day.day, dayKey, workoutName, scheduled: true });
    } catch (err) {
      results.push({
        day: day.day,
        dayKey,
        workoutName,
        scheduled: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Remember created workout ids for dedupe on re-push.
  await prisma.weeklyPlan.update({
    where: { id: plan.id },
    data: { planJson: { ...planJson, garminPush: { workoutIds: createdIds, pushedAt: new Date().toISOString() } } as object },
  });

  return results;
}
