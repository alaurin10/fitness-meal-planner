import { randomUUID } from "node:crypto";
import type { GroceryItem } from "@platform/db";
import type { MealPlanJson } from "./mealPlanSchema.js";
import {
  classifyCategory,
  normalizeCategory,
} from "./groceryCategorizer.js";

export function buildGroceryItems(plan: MealPlanJson): GroceryItem[] {
  const byName = new Map<string, GroceryItem>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.trim().toLowerCase();
        const existing = byName.get(key);
        const category =
          normalizeCategory(ing.category) ?? classifyCategory(ing.name);

        if (existing) {
          existing.qty = mergeQty(existing.qty, ing.qty);
        } else {
          byName.set(key, {
            id: randomUUID(),
            name: titleCase(ing.name),
            qty: ing.qty,
            category,
            checked: false,
            pushed: false,
          });
        }
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

function mergeQty(a: string, b: string): string {
  if (a === b) return a;
  return `${a} + ${b}`;
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}
