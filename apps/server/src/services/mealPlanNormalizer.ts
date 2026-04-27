import type { MealPlanJson, MealJson } from "./mealPlanSchema.js";
import { parseQuantityString, normalizeUnit } from "./quantity.js";

type LegacyIngredient = {
  name: string;
  qty?: string;
  quantity?: { amount: number; unit: string; display?: string };
  category?: string;
  note?: string;
};

type LegacyMeal = {
  name: string;
  slot?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  calories: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  ingredients: LegacyIngredient[];
  steps?: MealJson["steps"];
  tags?: string[];
  notes?: string;
};

type LegacyPlan = {
  summary: string;
  dailyCalorieTarget: number;
  days: Array<{
    day: MealPlanJson["days"][number]["day"];
    meals: LegacyMeal[];
  }>;
};

/**
 * Best-effort upgrade of older planJson rows (string `qty`, no `steps`,
 * missing `servings`) to the current shape so the UI can render them safely.
 * Generations going forward already produce the full shape.
 */
export function normalizeMealPlan(raw: unknown): MealPlanJson {
  const plan = raw as LegacyPlan;
  return {
    summary: plan.summary ?? "",
    dailyCalorieTarget: plan.dailyCalorieTarget ?? 0,
    days: (plan.days ?? []).map((d) => ({
      day: d.day,
      meals: (d.meals ?? []).map((m, idx) => normalizeMeal(m, idx)),
    })),
  };
}

const DEFAULT_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

function normalizeMeal(m: LegacyMeal, idx: number): MealJson {
  const ingredients = (m.ingredients ?? []).map((ing) => {
    const quantity = ing.quantity
      ? { ...ing.quantity, unit: normalizeUnit(ing.quantity.unit) }
      : parseQuantityString(ing.qty);
    return {
      name: ing.name,
      quantity,
      category: ing.category as MealJson["ingredients"][number]["category"],
      note: ing.note,
    };
  });

  const steps =
    m.steps && m.steps.length > 0
      ? m.steps
      : []; // empty steps array signals "no instructions available"

  return {
    name: m.name,
    slot: (m.slot as MealJson["slot"]) ?? DEFAULT_SLOTS[idx] ?? "snack",
    servings: m.servings ?? 1,
    prepMinutes: m.prepMinutes,
    cookMinutes: m.cookMinutes,
    totalMinutes:
      m.totalMinutes ??
      ((m.prepMinutes ?? 0) + (m.cookMinutes ?? 0) || undefined),
    calories: m.calories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    ingredients,
    steps,
    tags: m.tags,
    notes: m.notes,
    isLeftover: (m as Record<string, unknown>).isLeftover === true ? true : undefined,
  };
}
