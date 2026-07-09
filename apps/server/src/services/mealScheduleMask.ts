import { z } from "zod";
import { ALL_DAYS, type DayLabel } from "@platform/shared";
import { MEAL_SLOTS } from "@platform/db";
import type { MealPlanJson } from "./mealPlanSchema.js";

/**
 * Slot-level skip masks: which meals NOT to plan, per day. Used both as the
 * recurring template stored in UserSettings.mealScheduleJson and as one-off
 * per-request masks on generation endpoints.
 */

export type MealSlot = (typeof MEAL_SLOTS)[number];
export type SlotMask = Partial<Record<DayLabel, MealSlot[]>>;

export const slotMaskSchema = z.record(
  z.enum(ALL_DAYS as unknown as [DayLabel, ...DayLabel[]]),
  z.array(z.enum(MEAL_SLOTS)).max(4),
);

/** Parse a stored/incoming mask defensively; anything malformed → {}. */
export function parseSlotMask(raw: unknown): SlotMask {
  const parsed = slotMaskSchema.safeParse(raw);
  return parsed.success ? (parsed.data as SlotMask) : {};
}

/** True when the mask leaves nothing to plan for the day. Snacks are
 * optional extras, so a day counts as fully skipped once all three core
 * slots are masked. */
const CORE_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export function isDayFullySkipped(mask: SlotMask, day: DayLabel): boolean {
  const skipped = mask[day];
  if (!skipped?.length) return false;
  return CORE_SLOTS.every((slot) => skipped.includes(slot));
}

/** Window days minus fully-skipped days, order preserved. */
export function effectiveDaysToGenerate(days: DayLabel[], mask: SlotMask): DayLabel[] {
  return days.filter((day) => !isDayFullySkipped(mask, day));
}

/** True when the mask skips at least one core slot on the day (used to
 * exempt intentionally-light days from the macro corrective pass). */
export function dayHasSkippedCoreSlot(mask: SlotMask, day: DayLabel): boolean {
  const skipped = mask[day];
  return !!skipped?.some((slot) => CORE_SLOTS.includes(slot));
}

/**
 * Prompt lines for partially-skipped days, e.g.
 * "For Sat generate ONLY these meals: breakfast, lunch — the user is not
 * eating the other meals at home. Do not include the skipped slots."
 */
export function buildSlotMaskPromptLines(days: DayLabel[], mask: SlotMask): string[] {
  const lines: string[] = [];
  for (const day of days) {
    if (isDayFullySkipped(mask, day)) continue;
    const skipped = (mask[day] ?? []).filter((s) => CORE_SLOTS.includes(s));
    if (skipped.length === 0) continue;
    const keep = CORE_SLOTS.filter((slot) => !skipped.includes(slot));
    lines.push(
      `For ${day} generate ONLY these meals: ${keep.join(", ")} — the user is not eating the other meals at home. Do NOT include ${skipped.join(" or ")} for ${day}, and do not add a snack to compensate.`,
    );
  }
  return lines;
}

/**
 * Post-generation cleanup (run AFTER Zod validation, never before):
 * (a) strip any meal the model produced in a skipped slot,
 * (b) ensure every window day exists — fully-skipped days become
 *     `{ day, meals: [] }` in window order (a representation the app
 *     already supports via blank weeks).
 */
export function applySkipMask(
  plan: MealPlanJson,
  windowDays: DayLabel[],
  mask: SlotMask,
): MealPlanJson {
  const byDay = new Map(plan.days.map((d) => [d.day, d]));
  const days: MealPlanJson["days"] = windowDays.map((day) => {
    const skipped = mask[day] ?? [];
    const entry = byDay.get(day);
    if (!entry) return { day, meals: [] };
    if (skipped.length === 0) return entry;
    return {
      ...entry,
      meals: entry.meals.filter(
        (meal) => !meal.slot || !skipped.includes(meal.slot as MealSlot),
      ),
    };
  });
  // Keep any generated days outside the window (defensive; shouldn't happen).
  for (const d of plan.days) {
    if (!windowDays.includes(d.day)) days.push(d);
  }
  return { ...plan, days };
}
