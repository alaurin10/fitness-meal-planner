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
      for (const ing of meal.ingredients) {
        const category =
          normalizeCategory(ing.category) ?? classifyCategory(ing.name);
        const key = `${category}::${ing.name.trim().toLowerCase()}`;
        const existing = byKey.get(key);

        if (existing) {
          if (existing._displayParts) {
            existing._displayParts.push(quantityDisplay(ing.quantity));
            existing.qty = existing._displayParts.join(" + ");
          } else if (existing._quantity) {
            const merged = addQuantities(existing._quantity, ing.quantity);
            if (merged) {
              existing._quantity = merged;
              existing.qty = quantityDisplay(merged);
            } else {
              const parts = [
                quantityDisplay(existing._quantity),
                quantityDisplay(ing.quantity),
              ];
              existing._displayParts = parts;
              existing._quantity = undefined;
              existing.qty = parts.join(" + ");
            }
          }
        } else {
          byKey.set(key, {
            id: randomUUID(),
            name: titleCase(ing.name),
            qty: quantityDisplay(ing.quantity),
            category,
            checked: false,
            pushed: false,
            source: "auto",
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
