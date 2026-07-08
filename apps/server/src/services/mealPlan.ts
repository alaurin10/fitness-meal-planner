import type { Profile } from "@platform/db";
import type { DayLabel } from "@platform/shared";
import { callGemini, defaultTemperature, generateWithRetry, GenerationSkipError } from "./gemini.js";
import {
  buildSingleMealSystemPrompt,
  buildSingleMealUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  type FixedMealRef,
} from "./mealPlanPrompt.js";
import { dayHasSkippedCoreSlot, type SlotMask } from "./mealScheduleMask.js";
import {
  mealPlanSchema,
  mealSchema,
  type MealJson,
  type MealPlanJson,
} from "./mealPlanSchema.js";
import { mealPlanResponseSchema, mealResponseSchema } from "./geminiSchemas.js";
import { normalizeMealPlan } from "./mealPlanNormalizer.js";
import { buildMacroFeedback, evaluateMacros } from "./macroCheck.js";
import type { TrainingSchedule } from "./schedule.js";

const MACRO_CHECK_ENABLED = process.env.GEMINI_MACRO_CHECK !== "false";
// Cap how many off-target days a single corrective pass will regenerate, to
// bound added latency/cost. The worst offenders are prioritized.
const MAX_CORRECTIVE_DAYS = Math.max(1, Number(process.env.GEMINI_MACRO_MAX_DAYS) || 3);

interface GenerateMealPlanArgs {
  profile: Profile;
  schedule: TrainingSchedule;
  daysToGenerate?: DayLabel[];
  userSuggestion?: string;
  /** System-generated corrective guidance — kept separate from user text. */
  macroFeedback?: string;
  /** Recent meal names the model must not repeat (variety). */
  recentMealNames?: string[];
  varietyTone?: "soft" | "strict";
  /** Sampling temperature; defaults to defaultTemperature(). */
  temperature?: number;
  /** Slots to skip per day (partial-day masking). */
  skipMask?: SlotMask;
  /** User-locked meals the model plans around (batch canvas). */
  fixedMeals?: FixedMealRef[];
}

/** Core generation: prompt → structured Gemini call → normalize → Zod validate. */
async function generateMealPlanRaw(args: GenerateMealPlanArgs): Promise<MealPlanJson> {
  return generateWithRetry(async (model, attempt) => {
    const parsed = await callGemini({
      model,
      attempt,
      maxOutputTokens: 32768,
      responseSchema: mealPlanResponseSchema,
      systemInstruction: buildSystemPrompt(),
      contents: buildUserPrompt(args),
      temperature: args.temperature ?? defaultTemperature(),
    });

    const validated = mealPlanSchema.safeParse(normalizeMealPlan(parsed));
    if (!validated.success) {
      throw new GenerationSkipError(
        `Generated meal plan failed validation: ${validated.error.message}`,
      );
    }

    if (args.daysToGenerate?.length) {
      const generatedDays = new Set(validated.data.days.map((d) => d.day));
      const missing = args.daysToGenerate.filter((d) => !generatedDays.has(d));
      if (missing.length > 0) {
        throw new GenerationSkipError(
          `Generated plan is missing days: ${missing.join(", ")}`,
        );
      }
    }

    return validated.data;
  });
}

export async function generateMealPlan(args: GenerateMealPlanArgs): Promise<MealPlanJson> {
  const plan = await generateMealPlanRaw(args);
  if (!MACRO_CHECK_ENABLED) return plan;

  const report = evaluateMacros(plan, { proteinTargetG: args.profile.proteinTargetG });
  if (report.daysNeedingFix.length === 0) return plan;

  // Prioritize the worst calorie offenders, capped to bound cost. Exactly one
  // corrective round — we do NOT re-check the corrected output to avoid loops.
  // Days with a skipped core slot are intentionally light on macros; excluding
  // them stops the corrector from re-adding the meals the user asked to skip.
  const fixDays = [...report.deviations]
    .filter((d) => d.needsFix)
    .filter((d) => !(args.skipMask && dayHasSkippedCoreSlot(args.skipMask, d.day as DayLabel)))
    .sort((a, b) => Math.abs(b.calorieOffPct) - Math.abs(a.calorieOffPct))
    .slice(0, MAX_CORRECTIVE_DAYS)
    .map((d) => d.day as DayLabel);

  if (fixDays.length === 0) return plan;

  console.warn(
    `[meals] macro check flagged ${report.daysNeedingFix.length} day(s); correcting: ${fixDays.join(", ")}`,
  );

  try {
    const feedback = buildMacroFeedback(report, fixDays);
    const corrected = await generateMealPlanRaw({
      ...args,
      daysToGenerate: fixDays,
      macroFeedback: feedback,
    });
    for (const cd of corrected.days) {
      const idx = plan.days.findIndex((d) => d.day === cd.day);
      if (idx >= 0) plan.days[idx] = cd;
      else plan.days.push(cd);
    }
  } catch (err) {
    // The corrective pass is best-effort; the original plan is still valid.
    console.warn(
      `[meals] corrective macro pass failed, keeping original plan: ${(err as Error).message}`,
    );
  }

  return plan;
}

export async function generateSingleMeal(args: {
  profile: Profile;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  targetCalories?: number;
  targetProteinG?: number;
  avoidNames?: string[];
  userSuggestion?: string;
  temperature?: number;
}): Promise<MealJson> {
  return generateWithRetry(async (model, attempt) => {
    const parsed = await callGemini({
      model,
      attempt,
      maxOutputTokens: 8192,
      responseSchema: mealResponseSchema,
      systemInstruction: buildSingleMealSystemPrompt(),
      contents: buildSingleMealUserPrompt(args),
      temperature: args.temperature ?? defaultTemperature(),
    });

    const validated = mealSchema.safeParse(parsed);
    if (!validated.success) {
      throw new GenerationSkipError(
        `Generated meal failed validation: ${validated.error.message}`,
      );
    }
    return validated.data;
  });
}
