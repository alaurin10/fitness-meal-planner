import { describe, expect, it } from "vitest";
import { computeTargets, type TargetInputs } from "./targets.js";

const base: TargetInputs = {
  sex: "male",
  age: 30,
  weightLbs: 180,
  heightIn: 70,
  trainingDaysPerWeek: 4,
  goal: "maintain",
};

describe("computeTargets", () => {
  it("returns null when required inputs are missing", () => {
    expect(computeTargets({ ...base, sex: null })).toBeNull();
    expect(computeTargets({ ...base, age: null })).toBeNull();
    expect(computeTargets({ ...base, weightLbs: null })).toBeNull();
    expect(computeTargets({ ...base, heightIn: null })).toBeNull();
  });

  it("computes Mifflin-St Jeor based targets for a maintain goal", () => {
    // kg=81.648, cm=177.8, bmr≈1782.73, activity(4 days)=1.55 → ~2763 kcal
    // protein = 1.6 g/kg → ~131 g
    expect(computeTargets(base)).toEqual({ caloricTarget: 2763, proteinTargetG: 131 });
  });

  it("applies a deficit and higher protein for fat loss", () => {
    const maintain = computeTargets(base)!;
    const lose = computeTargets({ ...base, goal: "lose_fat" })!;
    expect(lose.caloricTarget).toBe(maintain.caloricTarget - 400);
    expect(lose.proteinTargetG).toBeGreaterThan(maintain.proteinTargetG); // 2.2 vs 1.6 g/kg
  });

  it("applies a surplus for muscle gain", () => {
    const maintain = computeTargets(base)!;
    const gain = computeTargets({ ...base, goal: "build_muscle" })!;
    expect(gain.caloricTarget).toBe(maintain.caloricTarget + 250);
  });

  it("uses the female BMR offset (lower than male, all else equal)", () => {
    const male = computeTargets(base)!;
    const female = computeTargets({ ...base, sex: "female" })!;
    expect(female.caloricTarget).toBeLessThan(male.caloricTarget);
  });

  it("enforces calorie and protein floors", () => {
    const tiny: TargetInputs = {
      sex: "female",
      age: 80,
      weightLbs: 70,
      heightIn: 58,
      trainingDaysPerWeek: 1,
      goal: "lose_fat",
    };
    const t = computeTargets(tiny)!;
    expect(t.caloricTarget).toBeGreaterThanOrEqual(1200);
    expect(t.proteinTargetG).toBeGreaterThanOrEqual(40);
  });
});
