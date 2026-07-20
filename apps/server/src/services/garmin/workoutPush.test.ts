import { describe, expect, it } from "vitest";
import {
  buildWorkoutServicePayload,
  convertPlanDay,
  mapExerciseToGarmin,
  parseRepsLowerBound,
} from "./workoutPush.js";

describe("parseRepsLowerBound", () => {
  it("takes the lower bound of a range", () => {
    expect(parseRepsLowerBound("8-10")).toBe(8);
    expect(parseRepsLowerBound("12–15")).toBe(12);
  });
  it("parses plain counts", () => {
    expect(parseRepsLowerBound("5")).toBe(5);
  });
  it("falls back for non-numeric prescriptions", () => {
    expect(parseRepsLowerBound("AMRAP")).toBe(10);
    expect(parseRepsLowerBound("max")).toBe(10);
    expect(parseRepsLowerBound(null)).toBe(10);
    expect(parseRepsLowerBound("—")).toBe(10);
  });
});

describe("mapExerciseToGarmin", () => {
  it("maps canonical lifts with qualifier stripping", () => {
    expect(mapExerciseToGarmin("Barbell Bench Press")).toEqual({
      category: "BENCH_PRESS",
      name: "BARBELL_BENCH_PRESS",
    });
    expect(mapExerciseToGarmin("Romanian Deadlift")).toEqual({
      category: "DEADLIFT",
      name: "ROMANIAN_DEADLIFT",
    });
  });
  it("matches by substring for decorated names", () => {
    expect(mapExerciseToGarmin("Paused Bench Press").category).toBe("BENCH_PRESS");
  });
  it("returns nulls for unknown exercises", () => {
    expect(mapExerciseToGarmin("Underwater Basket Press")).toEqual({ category: null, name: null });
  });
  it("maps the cable movements that used to fall through to null", () => {
    // Regression: these normalized to keys absent from the taxonomy, so they
    // pushed with no category and the watch relabeled them — breaking sync-back.
    expect(mapExerciseToGarmin("Cable Chest Flyes").category).toBe("FLYE");
    expect(mapExerciseToGarmin("Cable Crossover").category).toBe("FLYE");
    expect(mapExerciseToGarmin("Cable Triceps Pushdown").category).toBe("TRICEPS_EXTENSION");
    expect(mapExerciseToGarmin("Cable Woodchoppers").category).toBe("CORE");
    expect(mapExerciseToGarmin("Straight Arm Pulldown").category).toBe("PULL_UP");
  });
});

describe("convertPlanDay", () => {
  it("carries load into the description and keeps app names", () => {
    const payload = convertPlanDay(
      {
        day: "Mon",
        focus: "Push",
        exercises: [
          { name: "Bench Press", sets: 3, reps: "8-10", loadLbs: 135, restSeconds: 90 },
          { name: "Mystery Move", sets: 2, reps: "AMRAP", loadLbs: null, restSeconds: 0 },
        ],
      },
      "Push · Mon (FMP)",
    );
    expect(payload.steps).toHaveLength(2);
    expect(payload.steps[0]).toMatchObject({
      exerciseCategory: "BENCH_PRESS",
      description: "Bench Press @ 135 lbs",
      reps: 8,
      weightLbs: 135,
      restSeconds: 90,
      sets: 3,
    });
    // Unknown exercise still produces a followable generic step; zero rest
    // falls back to a sane default.
    expect(payload.steps[1]).toMatchObject({
      exerciseCategory: null,
      description: "Mystery Move",
      reps: 10,
      restSeconds: 60,
      sets: 2,
    });
  });
});

describe("buildWorkoutServicePayload", () => {
  const payload = convertPlanDay(
    {
      day: "Mon",
      focus: "Push",
      exercises: [{ name: "Bench Press", sets: 2, reps: "5", loadLbs: 220.46226, restSeconds: 60 }],
    },
    "Push · Mon (FMP)",
  );
  const body = buildWorkoutServicePayload(payload) as {
    sportType: { sportTypeKey: string };
    workoutSegments: { workoutSteps: Record<string, unknown>[] }[];
  };
  const steps = body.workoutSegments[0]!.workoutSteps;

  it("is a strength workout with one segment", () => {
    expect(body.sportType.sportTypeKey).toBe("strength_training");
    expect(body.workoutSegments).toHaveLength(1);
  });

  it("expands sets into interval steps with rest between, no trailing rest", () => {
    // 2 sets → interval, rest, interval (final rest omitted)
    expect(steps.map((s) => (s.stepType as { stepTypeKey: string }).stepTypeKey)).toEqual([
      "interval",
      "rest",
      "interval",
    ]);
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2, 3]);
  });

  it("uses rep end conditions and converts lbs to kg", () => {
    const interval = steps[0]!;
    expect((interval.endCondition as { conditionTypeKey: string }).conditionTypeKey).toBe("reps");
    expect(interval.endConditionValue).toBe(5);
    expect(interval.weightValue).toBeCloseTo(100, 1); // 220.46 lbs ≈ 100 kg
    expect(interval.category).toBe("BENCH_PRESS");
  });

  it("gives rest steps the prescribed duration", () => {
    const rest = steps[1]!;
    expect((rest.endCondition as { conditionTypeKey: string }).conditionTypeKey).toBe("fixed.rest");
    expect(rest.endConditionValue).toBe(60);
  });
});

describe("cardio finisher steps", () => {
  const payload = convertPlanDay(
    {
      day: "Mon",
      focus: "Push",
      exercises: [
        { name: "Bench Press", sets: 2, reps: "5", loadLbs: 135, restSeconds: 60 },
        {
          name: "Bike Intervals",
          sets: 1,
          reps: "—",
          loadLbs: null,
          restSeconds: 0,
          type: "cardio",
          durationMinutes: 15,
        },
      ],
    },
    "Push · Mon (FMP)",
  );

  it("converts cardio to a single time-based step", () => {
    expect(payload.steps).toHaveLength(2);
    expect(payload.steps[1]).toMatchObject({
      exerciseCategory: "CARDIO",
      exerciseName: null,
      description: "Bike Intervals — 15 min",
      sets: 1,
      weightLbs: null,
      durationSeconds: 900,
    });
  });

  it("emits one time-ended interval with no trailing rest and counts it in the estimate", () => {
    const body = buildWorkoutServicePayload(payload) as {
      estimatedDurationInSecs: number;
      workoutSegments: { workoutSteps: Record<string, unknown>[] }[];
    };
    const steps = body.workoutSegments[0]!.workoutSteps;
    // 2 bench sets with rest after each (cardio follows, so the second set's
    // rest is kept) + 1 cardio interval with nothing after it.
    expect(steps.map((s) => (s.stepType as { stepTypeKey: string }).stepTypeKey)).toEqual([
      "interval",
      "rest",
      "interval",
      "rest",
      "interval",
    ]);
    const cardio = steps[4]!;
    expect((cardio.endCondition as { conditionTypeKey: string }).conditionTypeKey).toBe("time");
    expect(cardio.endConditionValue).toBe(900);
    expect(cardio.weightValue).toBeNull();
    // 2 sets × 40s + 2 × 60s rest + 900s cardio
    expect(body.estimatedDurationInSecs).toBe(2 * 40 + 2 * 60 + 900);
  });
});
