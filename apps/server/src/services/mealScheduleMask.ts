import { z } from "zod";
import { ALL_DAYS, type DayLabel } from "@platform/shared";
import { MEAL_SLOTS } from "@platform/db";

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
