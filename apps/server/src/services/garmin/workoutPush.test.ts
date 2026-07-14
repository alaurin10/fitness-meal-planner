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
