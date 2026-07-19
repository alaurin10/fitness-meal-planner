import { describe, expect, it } from "vitest";
import { extractRecentExerciseNames } from "./workoutVarietyContext.js";
import type { WeeklyPlanJson } from "./workoutPlanSchema.js";

function plan(names: string[]): WeeklyPlanJson {
  return {
    summary: "s",
    progressionNotes: "p",
    days: [
      {
        day: "Mon",
        focus: "Push",
        exercises: names.map((name) => ({
          name,
          muscleGroup: "Chest",
          description: "d",
          sets: 3,
          reps: "8-10",
          loadLbs: null,
          restSeconds: 60,
          type: "strength" as const,
          durationMinutes: null,
        })),
      },
    ],
  };
}

describe("extractRecentExerciseNames", () => {
  it("collects names newest-plan-first", () => {
    const out = extractRecentExerciseNames([plan(["Bench Press"]), plan(["Squat"])], 10);
    expect(out).toEqual(["Bench Press", "Squat"]);
  });

  it("dedupes case-insensitively", () => {
    const out = extractRecentExerciseNames(
      [plan(["Bench Press", "bench press", "Squat"])],
      10,
    );
    expect(out).toEqual(["Bench Press", "Squat"]);
  });

  it("caps the list", () => {
    const out = extractRecentExerciseNames([plan(["A", "B", "C", "D"])], 2);
    expect(out).toEqual(["A", "B"]);
  });

  it("skips blank names", () => {
    const out = extractRecentExerciseNames([plan(["  ", "Row"])], 10);
    expect(out).toEqual(["Row"]);
  });
});
