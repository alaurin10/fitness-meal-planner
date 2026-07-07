import { describe, expect, it } from "vitest";
import {
  applyLeftoverUpdate,
  findDependentLeftovers,
  inferLeftoverLinks,
} from "./leftoverLinks.js";
import type { MealJson, MealPlanJson } from "./mealPlanSchema.js";

function meal(
  name: string,
  slot: MealJson["slot"],
  extra: Partial<MealJson> = {},
): MealJson {
  return {
    name,
    slot,
    servings: 1,
    calories: 500,
    proteinG: 30,
    ingredients: [{ name: "x", quantity: { amount: 1, unit: "g" } }],
    steps: [{ order: 1, text: "cook" }],
    ...extra,
  };
}

function plan(days: MealPlanJson["days"]): MealPlanJson {
  return { summary: "s", dailyCalorieTarget: 2000, days };
}

describe("inferLeftoverLinks", () => {
  it("links a legacy leftover to the earlier meal with the same name", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Chili", "dinner")] },
      { day: "Tue", meals: [meal("Chili", "lunch", { isLeftover: true })] },
    ]);
    inferLeftoverLinks(p);
    expect(p.days[1]!.meals[0]!.leftoverOf).toEqual({ day: "Mon", slot: "dinner" });
  });

  it("never links forward in time", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Chili", "lunch", { isLeftover: true })] },
      { day: "Tue", meals: [meal("Chili", "dinner")] },
    ]);
    inferLeftoverLinks(p);
    expect(p.days[0]!.meals[0]!.leftoverOf).toBeUndefined();
  });

  it("prefers the latest earlier occurrence and keeps existing links", () => {
    const existing = { day: "Mon", slot: "dinner" } as const;
    const p = plan([
      { day: "Mon", meals: [meal("Curry", "dinner")] },
      { day: "Wed", meals: [meal("Curry", "dinner")] },
      {
        day: "Thu",
        meals: [
          meal("Curry", "lunch", { isLeftover: true }),
          meal("Curry", "snack", { isLeftover: true, leftoverOf: existing }),
        ],
      },
    ]);
    inferLeftoverLinks(p);
    expect(p.days[2]!.meals[0]!.leftoverOf).toEqual({ day: "Wed", slot: "dinner" });
    expect(p.days[2]!.meals[1]!.leftoverOf).toEqual(existing);
  });
});

describe("findDependentLeftovers", () => {
  it("finds dependents via the structural link", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Chili", "dinner")] },
      {
        day: "Tue",
        meals: [
          meal("Renamed chili bowl", "lunch", {
            isLeftover: true,
            leftoverOf: { day: "Mon", slot: "dinner" },
          }),
        ],
      },
    ]);
    const deps = findDependentLeftovers(p, "Mon", 0);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ day: "Tue", index: 0 });
  });

  it("falls back to name matching for unlinked legacy leftovers", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Chili", "dinner")] },
      { day: "Tue", meals: [meal("Chili", "lunch", { isLeftover: true })] },
    ]);
    // Simulate raw legacy data (no inference pass).
    const deps = findDependentLeftovers(p, "Mon", 0);
    expect(deps).toHaveLength(1);
  });

  it("returns [] for leftover sources and unrelated meals", () => {
    const p = plan([
      { day: "Mon", meals: [meal("Chili", "dinner"), meal("Salad", "lunch")] },
      { day: "Tue", meals: [meal("Chili", "lunch", { isLeftover: true })] },
    ]);
    expect(findDependentLeftovers(p, "Mon", 1)).toEqual([]);
    expect(findDependentLeftovers(p, "Tue", 0)).toEqual([]);
  });
});

describe("applyLeftoverUpdate", () => {
  it("copies the source identity onto the target and relinks it", () => {
    const p = plan([
      {
        day: "Mon",
        meals: [
          meal("New salmon bake", "dinner", {
            calories: 640,
            proteinG: 48,
            carbsG: 30,
            fatG: 22,
            tags: ["one-pan"],
          }),
        ],
      },
      {
        day: "Tue",
        meals: [
          meal("Old chili", "lunch", {
            isLeftover: true,
            leftoverOf: { day: "Mon", slot: "dinner" },
          }),
        ],
      },
    ]);
    applyLeftoverUpdate(p, { day: "Tue", index: 0 }, { day: "Mon", index: 0 });
    const updated = p.days[1]!.meals[0]!;
    expect(updated.name).toBe("New salmon bake");
    expect(updated.calories).toBe(640);
    expect(updated.proteinG).toBe(48);
    expect(updated.isLeftover).toBe(true);
    expect(updated.servings).toBe(1);
    expect(updated.slot).toBe("lunch");
    expect(updated.leftoverOf).toEqual({ day: "Mon", slot: "dinner" });
    expect(updated.notes).toContain("Leftovers from Mon dinner");
  });

  it("is a no-op when target or source is missing", () => {
    const p = plan([{ day: "Mon", meals: [meal("A", "dinner")] }]);
    expect(() =>
      applyLeftoverUpdate(p, { day: "Tue", index: 0 }, { day: "Mon", index: 5 }),
    ).not.toThrow();
  });
});
