import { describe, expect, it } from "vitest";
import { buildMacroFeedback, evaluateMacros } from "./macroCheck.js";
import type { MealPlanJson } from "./mealPlanSchema.js";

function meal(calories: number, proteinG: number): MealPlanJson["days"][number]["meals"][number] {
  return {
    name: "x",
    servings: 1,
    calories,
    proteinG,
    ingredients: [{ name: "x", quantity: { amount: 1, unit: "g" } }],
    steps: [],
  };
}

function plan(
  dailyCalorieTarget: number,
  days: Array<{ day: MealPlanJson["days"][number]["day"]; meals: Array<[number, number]> }>,
): MealPlanJson {
  return {
    summary: "s",
    dailyCalorieTarget,
    days: days.map((d) => ({ day: d.day, meals: d.meals.map(([c, p]) => meal(c, p)) })),
  };
}

describe("evaluateMacros", () => {
  it("flags no days when every day is within tolerance", () => {
    const p = plan(2300, [
      { day: "Mon", meals: [[1150, 90], [1150, 90]] }, // exactly on target
      { day: "Tue", meals: [[1200, 100], [1100, 95]] }, // 2300 / 195g
    ]);
    const report = evaluateMacros(p, { proteinTargetG: 180 });
    expect(report.daysNeedingFix).toEqual([]);
  });

  it("flags a day whose calories fall well under the target", () => {
    const p = plan(2300, [
      { day: "Mon", meals: [[1150, 90], [1150, 90]] },
      { day: "Tue", meals: [[800, 40]] }, // far under on both
    ]);
    const report = evaluateMacros(p, { proteinTargetG: 180 });
    expect(report.daysNeedingFix).toEqual(["Tue"]);
    const tue = report.deviations.find((d) => d.day === "Tue")!;
    expect(tue.needsFix).toBe(true);
    expect(tue.calorieOffPct).toBeLessThan(-12);
    expect(tue.proteinUnderPct).toBeGreaterThan(15);
  });

  it("flags a day whose calories run well over the target", () => {
    const p = plan(2000, [{ day: "Mon", meals: [[1600, 100], [1200, 80]] }]); // 2800 = +40%
    const report = evaluateMacros(p, { proteinTargetG: 150 });
    expect(report.daysNeedingFix).toEqual(["Mon"]);
    expect(report.deviations[0]!.calorieOffPct).toBeGreaterThan(12);
  });

  it("flags protein shortfall even when calories are on target", () => {
    const p = plan(2000, [{ day: "Mon", meals: [[2000, 60]] }]); // calories perfect, protein low
    const report = evaluateMacros(p, { proteinTargetG: 180 });
    expect(report.daysNeedingFix).toEqual(["Mon"]);
  });

  it("does not flag excess protein", () => {
    const p = plan(2000, [{ day: "Mon", meals: [[2000, 250]] }]);
    const report = evaluateMacros(p, { proteinTargetG: 180 });
    expect(report.daysNeedingFix).toEqual([]);
  });

  it("skips protein checks when no protein target is provided", () => {
    const p = plan(2000, [{ day: "Mon", meals: [[2000, 10]] }]);
    const report = evaluateMacros(p, { proteinTargetG: null });
    expect(report.daysNeedingFix).toEqual([]);
    expect(report.deviations[0]!.proteinUnderPct).toBe(0);
  });

  it("does not flag on calories when the plan has no calorie target", () => {
    const p = plan(0, [{ day: "Mon", meals: [[500, 200]] }]);
    const report = evaluateMacros(p, { proteinTargetG: 150 });
    // protein is over target, calories untargeted → nothing to fix
    expect(report.daysNeedingFix).toEqual([]);
    expect(report.deviations[0]!.calorieOffPct).toBe(0);
  });
});

describe("buildMacroFeedback", () => {
  it("includes concrete per-day deltas for the requested days", () => {
    const p = plan(2300, [
      { day: "Mon", meals: [[1150, 90], [1150, 90]] },
      { day: "Tue", meals: [[800, 40]] },
    ]);
    const report = evaluateMacros(p, { proteinTargetG: 180 });
    const feedback = buildMacroFeedback(report, ["Tue"]);
    expect(feedback).toContain("MACRO CORRECTION");
    expect(feedback).toContain("Tue");
    expect(feedback).toContain("800 kcal");
    expect(feedback).toContain("2300");
    expect(feedback).toContain("under");
    // Only the requested day appears.
    expect(feedback).not.toContain("Mon");
  });
});
