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

      // Scale per-serving ingredient quantities by the meal's serving count
      // so multi-serving meals (e.g. cook 2 to save 1 for leftovers) add the
      // correct total to the grocery list.
      const servings = meal.servings ?? 1;

      for (const ing of meal.ingredients) {
        const cleanName = normalizeIngredientName(ing.name);
        const category =
          normalizeCategory(ing.category) ?? classifyCategory(cleanName);
        const key = `${category}::${cleanName.trim().toLowerCase()}`;

        // Build the scaled quantity for this ingredient
        const scaledQuantity: QuantityJson = {
          ...ing.quantity,
          amount: round2(ing.quantity.amount * servings),
        };

        const existing = byKey.get(key);

        if (existing) {
          if (existing._displayParts) {
            existing._displayParts.push(quantityDisplay(scaledQuantity));
            existing.qty = existing._displayParts.join(" + ");
            existing.amount = undefined;
            existing.unit = undefined;
          } else if (existing._quantity) {
            const merged = addQuantities(existing._quantity, scaledQuantity);
            if (merged) {
              existing._quantity = merged;
              existing.qty = quantityDisplay(merged);
              existing.amount = merged.amount;
              existing.unit = merged.unit;
            } else {
              const parts = [
                quantityDisplay(existing._quantity),
                quantityDisplay(scaledQuantity),
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
            qty: quantityDisplay(scaledQuantity),
            category,
            checked: false,
            pushed: false,
            source: "auto",
            amount: scaledQuantity.amount,
            unit: scaledQuantity.unit,
            _quantity: { ...scaledQuantity },
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
