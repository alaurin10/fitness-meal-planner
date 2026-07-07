import { describe, expect, it } from "vitest";
import {
  collectWeekAvoidNames,
  extractRecentMealNames,
  varietyParams,
} from "./varietyContext.js";
import type { MealPlanJson } from "./mealPlanSchema.js";

function meal(name: string, isLeftover = false): MealPlanJson["days"][number]["meals"][number] {
  return {
    name,
    servings: 1,
    calories: 500,
    proteinG: 30,
    ingredients: [{ name: "x", quantity: { amount: 1, unit: "g" } }],
    steps: [],
    ...(isLeftover ? { isLeftover: true } : {}),
  };
}

function plan(days: Array<{ day: MealPlanJson["days"][number]["day"]; meals: ReturnType<typeof meal>[] }>): MealPlanJson {
  return { summary: "s", dailyCalorieTarget: 2000, days };
}

describe("varietyParams", () => {
  it("maps each strength to its params", () => {
    expect(varietyParams("low").weeksBack).toBe(1);
    expect(varietyParams("medium").nameCap).toBe(40);
    expect(varietyParams("high")).toMatchObject({ weeksBack: 3, promptTone: "strict" });
  });

  it("falls back to medium for unknown/absent values", () => {
    expect(varietyParams(null)).toEqual(varietyParams("medium"));
    expect(varietyParams("extreme")).toEqual(varietyParams("medium"));
    expect(varietyParams(undefined)).toEqual(varietyParams("medium"));
  });
});

describe("extractRecentMealNames", () => {
  it("collects names newest-plan-first, skipping leftovers", () => {
    const newest = plan([
      { day: "Mon", meals: [meal("Chicken tikka"), meal("Chicken tikka", true)] },
    ]);
    const older = plan([{ day: "Tue", meals: [meal("Beef ragu")] }]);
    expect(extractRecentMealNames([newest, older], 10)).toEqual([
      "Chicken tikka",
      "Beef ragu",
    ]);
  });

  it("dedupes case-insensitively and respects the cap", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Miso Salmon"), meal("miso salmon"), meal("Tofu bowl")] },
      { day: "Tue", meals: [meal("Greek salad")] },
    ]);
    expect(extractRecentMealNames([p], 2)).toEqual(["Miso Salmon", "Tofu bowl"]);
  });

  it("ignores blank names and returns [] for no plans", () => {
    const p = plan([{ day: "Mon", meals: [meal("  ")] }]);
    expect(extractRecentMealNames([p], 5)).toEqual([]);
    expect(extractRecentMealNames([], 5)).toEqual([]);
  });
});

describe("collectWeekAvoidNames", () => {
  const p = plan([
    { day: "Mon", meals: [meal("Oats"), meal("Chicken wrap")] },
    { day: "Tue", meals: [meal("Chicken wrap", true), meal("Salmon rice")] },
  ]);

  it("excludes the target cell and leftover entries", () => {
    const names = collectWeekAvoidNames(p, { day: "Mon", index: 1 });
    expect(names).toEqual(["Oats", "Salmon rice"]);
  });

  it("dedupes across days and respects the cap", () => {
    const names = collectWeekAvoidNames(p, { day: "Tue", index: 1 }, 1);
    expect(names).toEqual(["Oats"]);
  });
});
