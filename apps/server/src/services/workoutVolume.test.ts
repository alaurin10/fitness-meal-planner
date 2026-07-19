import { describe, expect, it } from "vitest";
import { computeWorkoutVolumeLbs, parseRepsForVolume } from "./workoutVolume.js";

describe("parseRepsForVolume", () => {
  it("takes the midpoint of a range", () => {
    expect(parseRepsForVolume("8-10")).toBe(9);
  });
  it("parses plain counts", () => {
    expect(parseRepsForVolume("5")).toBe(5);
  });
  it("returns 0 for non-numeric prescriptions", () => {
    expect(parseRepsForVolume("—")).toBe(0);
    expect(parseRepsForVolume(null)).toBe(0);
  });
});

describe("computeWorkoutVolumeLbs", () => {
  it("sums load × reps × completed sets", () => {
    const total = computeWorkoutVolumeLbs({
      exercises: [{ loadLbs: 100, reps: "10" }],
      completedSets: { "0": [1, 2] },
      profileWeightLbs: 180,
    });
    expect(total).toBe(2000);
  });

  it("ignores cardio entries even when marked complete", () => {
    const total = computeWorkoutVolumeLbs({
      exercises: [
        { loadLbs: 100, reps: "10" },
        // A completed cardio block must not credit bodyweight-fallback volume,
        // even if its reps string happens to contain a number.
        { loadLbs: null, reps: "12", type: "cardio" },
      ],
      completedSets: { "0": [1], "1": [1] },
      profileWeightLbs: 180,
    });
    expect(total).toBe(1000);
  });
});
