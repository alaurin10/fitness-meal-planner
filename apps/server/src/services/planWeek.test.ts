import { describe, expect, it } from "vitest";
import {
  assemblePlan,
  cellsToSkipMask,
  generateDays,
  type FixedMeal,
  type PlanCell,
} from "./planWeek.js";
import type { DayLabel } from "@platform/shared";
import type { MealJson, MealPlanJson } from "./mealPlanSchema.js";

function meal(name: string, slot: MealJson["slot"]): MealJson {
  return {
    name,
    slot,
    servings: 1,
    calories: 500,
    proteinG: 30,
    ingredients: [{ name: "x", quantity: { amount: 1, unit: "g" } }],
    steps: [],
  };
}

describe("cellsToSkipMask", () => {
  it("skips core slots not explicitly kept, ignoring snack", () => {
    const cells: PlanCell[] = [
      { day: "Mon", slot: "breakfast", mode: "generate" },
      { day: "Mon", slot: "dinner", mode: "recipe", recipeId: "r1" },
    ];
    const mask = cellsToSkipMask(cells, ["Mon"]);
    // lunch not present → skipped; breakfast/dinner kept; snack never core.
    expect(mask.Mon).toEqual(["lunch"]);
  });

  it("marks a day with no cells as fully skipped", () => {
    const mask = cellsToSkipMask([{ day: "Mon", slot: "breakfast", mode: "generate" }], ["Mon", "Tue"]);
    expect(mask.Tue).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("treats an explicit skip cell as not keeping the slot", () => {
    const cells: PlanCell[] = [
      { day: "Mon", slot: "breakfast", mode: "generate" },
      { day: "Mon", slot: "lunch", mode: "skip" },
      { day: "Mon", slot: "dinner", mode: "generate" },
    ];
    expect(cellsToSkipMask(cells, ["Mon"]).Mon).toEqual(["lunch"]);
  });
});

describe("generateDays", () => {
  it("returns days with a generate cell in week order", () => {
    const cells: PlanCell[] = [
      { day: "Wed", slot: "dinner", mode: "generate" },
      { day: "Mon", slot: "breakfast", mode: "recipe", recipeId: "r" },
      { day: "Mon", slot: "dinner", mode: "generate" },
    ];
    expect(generateDays(cells)).toEqual(["Mon", "Wed"]);
  });
});

describe("assemblePlan", () => {
  it("merges fixed + generated meals sorted by slot order", () => {
    const windowDays: DayLabel[] = ["Mon", "Tue"];
    const fixed: FixedMeal[] = [
      { day: "Mon", slot: "dinner", meal: meal("Book dinner", "dinner") },
    ];
    const generated: MealPlanJson = {
      summary: "g",
      dailyCalorieTarget: 2000,
      days: [{ day: "Mon", meals: [meal("AI breakfast", "breakfast")] }],
    };
    const out = assemblePlan(windowDays, fixed, generated, "Your week", 2100);
    expect(out.summary).toBe("Your week");
    expect(out.dailyCalorieTarget).toBe(2100);
    expect(out.days.map((d) => d.day)).toEqual(["Mon", "Tue"]);
    // breakfast before dinner despite fixed being listed first
    expect(out.days[0]!.meals.map((m) => m.name)).toEqual(["AI breakfast", "Book dinner"]);
    expect(out.days[1]!.meals).toEqual([]);
  });

  it("drops a generated meal that collides with a fixed slot", () => {
    const fixed: FixedMeal[] = [
      { day: "Mon", slot: "dinner", meal: meal("Book dinner", "dinner") },
    ];
    // The model ignored the LOCKED block and re-emitted a Mon dinner.
    const generated: MealPlanJson = {
      summary: "g",
      dailyCalorieTarget: 2000,
      days: [
        {
          day: "Mon",
          meals: [meal("AI breakfast", "breakfast"), meal("AI dinner", "dinner")],
        },
      ],
    };
    const out = assemblePlan(["Mon"], fixed, generated, "Your week", 2000);
    // Only the fixed dinner survives — no duplicate dinner slot.
    expect(out.days[0]!.meals.map((m) => m.name)).toEqual(["AI breakfast", "Book dinner"]);
  });
});
