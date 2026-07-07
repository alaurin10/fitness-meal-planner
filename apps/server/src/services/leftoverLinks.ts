import type { DayLabel } from "@platform/shared";
import type { LeftoverOf, MealJson, MealPlanJson } from "./mealPlanSchema.js";

/**
 * Structural dinner→leftover links.
 *
 * Leftover meals historically carried only `isLeftover: true` with the link
 * to their source meal implied by a matching name — so replacing a dinner
 * silently orphaned the next day's "leftovers" lunch. These helpers give the
 * link a real shape (`leftoverOf: { day, slot }`), infer it for legacy plans,
 * find dependents when a source meal changes, and rewrite a dependent to
 * follow its new source.
 */

const DAY_ORDER: DayLabel[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayRank(day: DayLabel): number {
  return DAY_ORDER.indexOf(day);
}

/** True when (dayA, indexA) comes before (dayB, indexB) in the week. */
function isEarlier(dayA: DayLabel, indexA: number, dayB: DayLabel, indexB: number): boolean {
  const ra = dayRank(dayA);
  const rb = dayRank(dayB);
  if (ra !== rb) return ra < rb;
  return indexA < indexB;
}

/**
 * Fill in `leftoverOf` for legacy leftover meals by matching their name
 * (case-insensitive) against an EARLIER non-leftover meal. Never links
 * forward in time; leaves already-linked meals untouched. Returns the same
 * plan object (meals are patched in place — callers own the copy).
 */
export function inferLeftoverLinks(plan: MealPlanJson): MealPlanJson {
  // Index non-leftover meals by lowercase name for O(week) lookup.
  const sources = new Map<string, Array<{ day: DayLabel; index: number; meal: MealJson }>>();
  for (const day of plan.days) {
    day.meals.forEach((meal, index) => {
      if (meal.isLeftover) return;
      const key = meal.name.trim().toLowerCase();
      if (!key) return;
      const list = sources.get(key) ?? [];
      list.push({ day: day.day, index, meal });
      sources.set(key, list);
    });
  }

  for (const day of plan.days) {
    day.meals.forEach((meal, index) => {
      if (!meal.isLeftover || meal.leftoverOf) return;
      const candidates = sources.get(meal.name.trim().toLowerCase());
      if (!candidates) return;
      // Latest earlier occurrence wins (leftovers usually follow the night before).
      let best: (typeof candidates)[number] | undefined;
      for (const c of candidates) {
        if (!isEarlier(c.day, c.index, day.day, index)) continue;
        if (!best || isEarlier(best.day, best.index, c.day, c.index)) best = c;
      }
      if (best?.meal.slot) {
        meal.leftoverOf = { day: best.day, slot: best.meal.slot };
      }
    });
  }
  return plan;
}

export interface DependentLeftover {
  day: DayLabel;
  index: number;
  meal: MealJson;
}

/**
 * Leftover meals that depend on the meal at (day, index): linked via
 * `leftoverOf` matching the source's day+slot, or (legacy fallback) an
 * unlinked leftover with the same name later in the week.
 */
export function findDependentLeftovers(
  plan: MealPlanJson,
  day: DayLabel,
  index: number,
): DependentLeftover[] {
  const dayEntry = plan.days.find((d) => d.day === day);
  const source = dayEntry?.meals[index];
  if (!source || source.isLeftover) return [];
  const sourceSlot = source.slot;
  const sourceName = source.name.trim().toLowerCase();

  const dependents: DependentLeftover[] = [];
  for (const d of plan.days) {
    d.meals.forEach((meal, i) => {
      if (!meal.isLeftover) return;
      if (d.day === day && i === index) return;
      const linked =
        meal.leftoverOf != null &&
        meal.leftoverOf.day === day &&
        sourceSlot != null &&
        meal.leftoverOf.slot === sourceSlot;
      const nameFallback =
        meal.leftoverOf == null &&
        meal.name.trim().toLowerCase() === sourceName &&
        isEarlier(day, index, d.day, i);
      if (linked || nameFallback) dependents.push({ day: d.day, index: i, meal });
    });
  }
  return dependents;
}

/**
 * Rewrite the leftover at `target` to follow the (new) source meal: copy the
 * cookable identity (name/ingredients/macros/steps/tags), keep it a single
 * leftover serving, and point the link at the source. Mutates in place.
 */
export function applyLeftoverUpdate(
  plan: MealPlanJson,
  target: { day: DayLabel; index: number },
  source: { day: DayLabel; index: number },
): MealPlanJson {
  const sourceMeal = plan.days.find((d) => d.day === source.day)?.meals[source.index];
  const targetDay = plan.days.find((d) => d.day === target.day);
  const targetMeal = targetDay?.meals[target.index];
  if (!sourceMeal || !targetMeal || !targetDay) return plan;

  const link: LeftoverOf | undefined = sourceMeal.slot
    ? { day: source.day, slot: sourceMeal.slot }
    : undefined;

  targetDay.meals[target.index] = {
    ...targetMeal,
    name: sourceMeal.name,
    calories: sourceMeal.calories,
    proteinG: sourceMeal.proteinG,
    carbsG: sourceMeal.carbsG,
    fatG: sourceMeal.fatG,
    ingredients: sourceMeal.ingredients.map((ing) => ({ ...ing, quantity: { ...ing.quantity } })),
    steps: sourceMeal.steps.map((s) => ({ ...s })),
    tags: sourceMeal.tags ? [...sourceMeal.tags] : undefined,
    servings: 1,
    prepMinutes: 0,
    cookMinutes: 0,
    totalMinutes: 0,
    isLeftover: true,
    leftoverOf: link,
    notes: `Leftovers from ${source.day} ${sourceMeal.slot ?? "dinner"}.`,
  };
  return plan;
}
