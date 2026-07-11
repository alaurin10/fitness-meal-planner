import { z } from "zod";
import { ALL_DAYS, type DayLabel } from "@platform/shared";
import { MEAL_SLOTS } from "@platform/db";
import type { MealJson, MealPlanJson } from "./mealPlanSchema.js";
import type { SlotMask, MealSlot } from "./mealScheduleMask.js";

/**
 * The week-building canvas sends one cell per (day, slot) it cares about.
 * "generate" → AI fills it; "recipe" → a book recipe; "keep" → the meal
 * already in the current plan at that day+slot; "skip" → leave it empty.
 * Any (day, slot) NOT present is treated as skipped.
 */
export type CellMode = "generate" | "recipe" | "keep" | "skip";

export interface PlanCell {
  day: DayLabel;
  slot: MealSlot;
  mode: CellMode;
  recipeId?: string;
}

export const planWeekCellSchema = z
  .object({
    day: z.enum(ALL_DAYS as unknown as [DayLabel, ...DayLabel[]]),
    slot: z.enum(MEAL_SLOTS),
    mode: z.enum(["generate", "recipe", "keep", "skip"]),
    recipeId: z.string().min(1).optional(),
  })
  .refine((c) => c.mode !== "recipe" || !!c.recipeId, {
    message: "recipe cells require a recipeId",
  });

export const planWeekCellsSchema = z.array(planWeekCellSchema).min(1).max(28);

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const CORE_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

/**
 * Derive the skip mask from the cell list: any core slot that isn't an
 * explicit generate/recipe/keep cell for a day is treated as skipped, so the
 * generator only produces the requested "generate" slots.
 */
export function cellsToSkipMask(cells: PlanCell[], windowDays: DayLabel[]): SlotMask {
  const active = new Map<DayLabel, Set<MealSlot>>();
  for (const cell of cells) {
    if (cell.mode === "skip") continue;
    const set = active.get(cell.day) ?? new Set<MealSlot>();
    set.add(cell.slot);
    active.set(cell.day, set);
  }
  const mask: SlotMask = {};
  for (const day of windowDays) {
    const kept = active.get(day) ?? new Set<MealSlot>();
    const skipped = CORE_SLOTS.filter((slot) => !kept.has(slot));
    if (skipped.length) mask[day] = skipped;
  }
  return mask;
}

/** Days that have at least one "generate" cell. */
export function generateDays(cells: PlanCell[]): DayLabel[] {
  const days = new Set<DayLabel>();
  for (const cell of cells) if (cell.mode === "generate") days.add(cell.day);
  return ALL_DAYS.filter((d) => days.has(d as DayLabel)) as DayLabel[];
}

/** Days the user asked the AI to generate a snack for. Snacks aren't part of
 * the core skip mask, so the generator must be told about them explicitly. */
export function snackGenerateDays(cells: PlanCell[]): DayLabel[] {
  const days = new Set<DayLabel>();
  for (const cell of cells) {
    if (cell.slot === "snack" && cell.mode === "generate") days.add(cell.day);
  }
  return ALL_DAYS.filter((d) => days.has(d as DayLabel)) as DayLabel[];
}

export interface FixedMeal {
  day: DayLabel;
  slot: MealSlot;
  meal: MealJson;
}

/**
 * Merge fixed (recipe/keep) meals with AI-generated days into one plan JSON.
 * Days follow `windowDays` order; within a day, meals are sorted by canonical
 * slot order so completion indices and detail-view links stay stable.
 *
 * Fixed meals win their slot: any generated meal that collides with a fixed
 * (day, slot) is dropped. The generator is told about locked slots only via
 * the prompt's LOCKED MEALS block (their slot isn't in the skip mask), so a
 * model that ignores the instruction and re-emits a locked slot would
 * otherwise produce a duplicate meal on that day.
 */
export function assemblePlan(
  windowDays: DayLabel[],
  fixed: FixedMeal[],
  generated: MealPlanJson | null,
  summary: string,
  dailyCalorieTarget: number,
): MealPlanJson {
  const genByDay = new Map<DayLabel, MealJson[]>();
  for (const d of generated?.days ?? []) {
    genByDay.set(d.day as DayLabel, d.meals);
  }
  const fixedByDay = new Map<DayLabel, FixedMeal[]>();
  for (const f of fixed) {
    const list = fixedByDay.get(f.day) ?? [];
    list.push(f);
    fixedByDay.set(f.day, list);
  }

  const days = windowDays.map((day) => {
    const fixedForDay = fixedByDay.get(day) ?? [];
    const fixedSlots = new Set(fixedForDay.map((f) => f.slot));
    const meals: MealJson[] = [
      ...fixedForDay.map((f) => ({ ...f.meal, slot: f.slot })),
      ...(genByDay.get(day) ?? []).filter(
        (m) => !m.slot || !fixedSlots.has(m.slot as MealSlot),
      ),
    ];
    meals.sort(
      (a, b) =>
        SLOT_ORDER.indexOf((a.slot ?? "snack") as MealSlot) -
        SLOT_ORDER.indexOf((b.slot ?? "snack") as MealSlot),
    );
    return { day, meals };
  });

  return {
    summary,
    dailyCalorieTarget,
    days,
  };
}
