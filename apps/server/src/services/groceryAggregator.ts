import { randomUUID } from "node:crypto";
import type { GroceryItem } from "@platform/db";
import type { MealPlanJson, QuantityJson } from "./mealPlanSchema.js";
import {
  classifyCategory,
  normalizeCategory,
} from "./groceryCategorizer.js";
import { addQuantities, quantityDisplay } from "./quantity.js";

interface AggregatedItem extends GroceryItem {
  /** Internal: kept only to merge structured quantities; not persisted. */
  _quantity?: QuantityJson;
  /** Internal: kept only when units are incompatible and we fall back to a string display. */
  _displayParts?: string[];
}

export function buildGroceryItems(plan: MealPlanJson): GroceryItem[] {
  const byKey = new Map<string, AggregatedItem>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      // Skip leftover meals — their ingredients were already counted
      // on the day the meal was originally cooked.
      if (meal.isLeftover) continue;

      // Ingredient quantities are stored as totals needed to cook the
      // meal at its `servings` size (cookbook convention), so the
      // aggregator adds them in as-is without further scaling.

      for (const ing of meal.ingredients) {
        const cleanName = normalizeIngredientName(ing.name);
        const category =
          normalizeCategory(ing.category) ?? classifyCategory(cleanName);
        const key = `${category}::${cleanName.trim().toLowerCase()}`;

        const existing = byKey.get(key);

        if (existing) {
          // "to taste" is non-quantitative — skip it when we already have a
          // real quantity, or just keep one instance if that's all we have.
          const isToTaste = ing.quantity.unit === "to taste" || ing.quantity.amount === 0 && ing.quantity.unit === "to taste";
          const existingIsToTaste = existing._quantity?.unit === "to taste";

          if (isToTaste && (existing._quantity || existing._displayParts)) {
            // Already have a real quantity or parts — ignore the "to taste"
          } else if (existingIsToTaste && !isToTaste) {
            // Replace the existing "to taste" with the real quantity
            existing._quantity = { ...ing.quantity };
            existing._displayParts = undefined;
            existing.qty = quantityDisplay(ing.quantity);
            existing.amount = ing.quantity.amount;
            existing.unit = ing.quantity.unit;
          } else if (existing._displayParts) {
            // Filter out any "to taste" parts before appending
            const newPart = quantityDisplay(ing.quantity);
            if (newPart !== "to taste") {
              existing._displayParts = existing._displayParts.filter((p) => p !== "to taste");
            }
            existing._displayParts.push(newPart);
            existing.qty = existing._displayParts.join(" + ");
            existing.amount = undefined;
            existing.unit = undefined;
          } else if (existing._quantity) {
            const merged = addQuantities(existing._quantity, ing.quantity);
            if (merged) {
              existing._quantity = merged;
              existing.qty = quantityDisplay(merged);
              existing.amount = merged.amount;
              existing.unit = merged.unit;
            } else {
              const parts = [
                quantityDisplay(existing._quantity),
                quantityDisplay(ing.quantity),
              ];
              existing._displayParts = parts;
              existing._quantity = undefined;
              existing.qty = parts.join(" + ");
              existing.amount = undefined;
              existing.unit = undefined;
            }
          }
        } else {
          byKey.set(key, {
            id: randomUUID(),
            name: titleCase(cleanName),
            qty: quantityDisplay(ing.quantity),
            category,
            checked: false,
            pushed: false,
            source: "auto",
            amount: ing.quantity.amount,
            unit: ing.quantity.unit,
            _quantity: { ...ing.quantity },
          });
        }
      }
    }
  }

  return Array.from(byKey.values())
    .map(stripInternal)
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
}

function stripInternal(item: AggregatedItem): GroceryItem {
  const { _quantity, _displayParts, ...rest } = item;
  void _quantity;
  void _displayParts;
  return rest;
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Strip cooking-state prefixes from ingredient names so that
 * "cooked chicken breast" and "chicken breast" aggregate together.
 */
const COOKING_PREFIXES = /^(cooked|grilled|roasted|steamed|boiled|sautéed|sauteed|baked|fried|braised|poached|smoked|blanched|charred|toasted|pan[- ]?fried|stir[- ]?fried|deep[- ]?fried)\s+/i;

function normalizeIngredientName(name: string): string {
  return name.trim().replace(COOKING_PREFIXES, "");
}
