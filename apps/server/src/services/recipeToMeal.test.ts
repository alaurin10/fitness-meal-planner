import { describe, expect, it } from "vitest";
import type { Recipe } from "@platform/db";
import { recipeToMealJson } from "./recipeToMeal.js";

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    userId: "u1",
    name: "Miso salmon",
    slotHint: "dinner",
    category: "other",
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 15,
    totalMinutes: 25,
    calories: 620,
    proteinG: 45,
    carbsG: 30,
    fatG: 22,
    ingredientsJson: [{ name: "salmon", quantity: { amount: 7, unit: "oz" } }],
    stepsJson: [{ order: 1, text: "Bake." }],
    tags: ["one-pan"],
    source: "MANUAL",
    notes: null,
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Recipe;
}

describe("recipeToMealJson", () => {
  it("maps recipe fields onto a meal for the given slot", () => {
    const meal = recipeToMealJson(recipe(), "lunch");
    expect(meal.name).toBe("Miso salmon");
    expect(meal.slot).toBe("lunch"); // requested slot overrides slotHint
    expect(meal.calories).toBe(620);
    expect(meal.proteinG).toBe(45);
    expect(meal.ingredients[0]!.name).toBe("salmon");
    expect(meal.steps[0]!.text).toBe("Bake.");
    expect(meal.tags).toEqual(["one-pan"]);
  });

  it("defaults servings to 1 and derives totalMinutes when absent", () => {
    const meal = recipeToMealJson(
      recipe({ servings: 0, totalMinutes: null, prepMinutes: 5, cookMinutes: 20 }),
      "dinner",
    );
    expect(meal.servings).toBe(1);
    expect(meal.totalMinutes).toBe(25);
  });
});
