import type { Meal, RecipeRecord } from "./types";

export function recipeToMeal(r: RecipeRecord): Meal {
  return {
    name: r.name,
    slot: r.slotHint ?? undefined,
    servings: r.servings,
    prepMinutes: r.prepMinutes ?? undefined,
    cookMinutes: r.cookMinutes ?? undefined,
    totalMinutes: r.totalMinutes ?? undefined,
    calories: r.calories,
    proteinG: r.proteinG,
    carbsG: r.carbsG ?? undefined,
    fatG: r.fatG ?? undefined,
    ingredients: r.ingredientsJson,
    steps: r.stepsJson,
    tags: r.tags,
    notes: r.notes ?? undefined,
  };
}
