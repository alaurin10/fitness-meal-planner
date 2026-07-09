import type { Recipe } from "@platform/db";
import { mealSchema, type MealJson } from "./mealPlanSchema.js";

/**
 * Convert a saved recipe-book Recipe into a plan Meal for a given slot.
 * Mirrors the client's recipeAdapter.recipeToMeal, then normalizes through
 * mealSchema so ingredients/steps validate the same as generated meals.
 */
export function recipeToMealJson(
  recipe: Recipe,
  slot: MealJson["slot"],
): MealJson {
  const raw = {
    name: recipe.name,
    slot: slot ?? (recipe.slotHint as MealJson["slot"]) ?? undefined,
    servings: recipe.servings > 0 ? recipe.servings : 1,
    prepMinutes: recipe.prepMinutes ?? undefined,
    cookMinutes: recipe.cookMinutes ?? undefined,
    totalMinutes:
      recipe.totalMinutes ??
      ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined),
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG ?? undefined,
    fatG: recipe.fatG ?? undefined,
    ingredients: recipe.ingredientsJson,
    steps: recipe.stepsJson,
    tags: recipe.tags,
    notes: recipe.notes ?? undefined,
  };
  // A stored recipe should already be valid; parse defensively so a malformed
  // ingredientsJson surfaces as a clear error rather than corrupting the plan.
  return mealSchema.parse(raw);
}
