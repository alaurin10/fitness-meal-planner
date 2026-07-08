import { describe, expect, it } from "vitest";
import {
  applySkipMask,
  buildSlotMaskPromptLines,
  dayHasSkippedCoreSlot,
  effectiveDaysToGenerate,
  isDayFullySkipped,
  parseSlotMask,
  type SlotMask,
} from "./mealScheduleMask.js";
import type { DayLabel } from "@platform/shared";
import type { MealPlanJson } from "./mealPlanSchema.js";

describe("isDayFullySkipped", () => {
  it("is true only when all three core slots are skipped", () => {
    expect(isDayFullySkipped({ Sun: ["breakfast", "lunch", "dinner"] }, "Sun")).toBe(true);
    expect(isDayFullySkipped({ Sun: ["breakfast", "lunch"] }, "Sun")).toBe(false);
  });
  it("ignores snack — a snack-only skip is not a full skip", () => {
    expect(isDayFullySkipped({ Sat: ["snack"] }, "Sat")).toBe(false);
    expect(
      isDayFullySkipped({ Sat: ["breakfast", "lunch", "dinner", "snack"] }, "Sat"),
    ).toBe(true);
  });
  it("is false for an unmasked day", () => {
    expect(isDayFullySkipped({}, "Mon")).toBe(false);
  });
});

describe("effectiveDaysToGenerate", () => {
  it("drops fully-skipped days, preserving order", () => {
    const days: DayLabel[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const mask: SlotMask = { Sun: ["breakfast", "lunch", "dinner"], Sat: ["dinner"] };
    expect(effectiveDaysToGenerate(days, mask)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });
});

describe("dayHasSkippedCoreSlot", () => {
  it("detects a partial core-slot skip but not a snack-only skip", () => {
    expect(dayHasSkippedCoreSlot({ Sat: ["dinner"] }, "Sat")).toBe(true);
    expect(dayHasSkippedCoreSlot({ Sat: ["snack"] }, "Sat")).toBe(false);
  });
});

describe("buildSlotMaskPromptLines", () => {
  it("emits one line per partially-skipped day and skips full/empty days", () => {
    const days: DayLabel[] = ["Sat", "Sun", "Mon"];
    const mask: SlotMask = {
      Sat: ["dinner"],
      Sun: ["breakfast", "lunch", "dinner"], // fully skipped → no line
    };
    const lines = buildSlotMaskPromptLines(days, mask);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("For Sat generate ONLY these meals: breakfast, lunch");
    expect(lines[0]).toContain("Do NOT include dinner for Sat");
  });
});

describe("applySkipMask", () => {
  function meal(slot: "breakfast" | "lunch" | "dinner" | "snack"): MealPlanJson["days"][number]["meals"][number] {
    return {
      name: slot,
      slot,
      servings: 1,
      calories: 500,
      proteinG: 30,
      ingredients: [{ name: "x", quantity: { amount: 1, unit: "g" } }],
      steps: [],
    };
  }

  it("strips masked slots and inserts empty days in window order", () => {
    const plan: MealPlanJson = {
      summary: "s",
      dailyCalorieTarget: 2000,
      days: [
        { day: "Sat", meals: [meal("breakfast"), meal("lunch"), meal("dinner")] },
      ],
    };
    const windowDays: DayLabel[] = ["Sat", "Sun"];
    const mask: SlotMask = { Sat: ["dinner"], Sun: ["breakfast", "lunch", "dinner"] };
    const out = applySkipMask(plan, windowDays, mask);
    expect(out.days.map((d) => d.day)).toEqual(["Sat", "Sun"]);
    expect(out.days[0]!.meals.map((m) => m.slot)).toEqual(["breakfast", "lunch"]);
    expect(out.days[1]!.meals).toEqual([]);
  });
});

describe("parseSlotMask", () => {
  it("keeps valid masks and rejects garbage", () => {
    expect(parseSlotMask({ Sat: ["dinner"] })).toEqual({ Sat: ["dinner"] });
    expect(parseSlotMask({ Xyz: ["dinner"] })).toEqual({});
    expect(parseSlotMask("nope")).toEqual({});
    expect(parseSlotMask(null)).toEqual({});
  });
});
