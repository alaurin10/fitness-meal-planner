import type {
  Profile,
  ProgressLog,
  UserExerciseBaseline,
  WeeklyPlan,
} from "@platform/db";
import { normalizeExerciseName, type DayLabel } from "@platform/shared";
import { callGemini, generateWithRetry, GenerationSkipError } from "./gemini.js";
import { buildSystemPrompt, buildUserPrompt } from "./workoutPlanPrompt.js";
import { weeklyPlanResponseSchema } from "./geminiSchemas.js";
import { weeklyPlanSchema, type WeeklyPlanJson } from "./workoutPlanSchema.js";

export async function generateWeeklyPlan(args: {
  profile: Profile;
  recentProgress: ProgressLog[];
  previousPlan: WeeklyPlan | null;
  baselines: UserExerciseBaseline[];
  daysToGenerate?: DayLabel[];
}): Promise<WeeklyPlanJson> {
  return generateWithRetry(async (model, attempt) => {
    const parsed = await callGemini({
      model,
      attempt,
      maxOutputTokens: 8192,
      responseSchema: weeklyPlanResponseSchema,
      systemInstruction: buildSystemPrompt(),
      contents: buildUserPrompt(args),
    });

    const validated = weeklyPlanSchema.safeParse(parsed);
    if (!validated.success) {
      throw new GenerationSkipError(
        `Generated plan failed validation: ${validated.error.message}`,
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

    return applyBaselineOverrides(validated.data, args.baselines);
  });
}

/**
 * Deterministic safety net: for every exercise the LLM produced, if the user
 * has a baseline whose normalizedKey matches, force the prescribed load to the
 * baseline weight. This is the contract that makes user-set weights stick
 * regardless of how the model interprets the prompt.
 */
function applyBaselineOverrides(
  plan: WeeklyPlanJson,
  baselines: UserExerciseBaseline[],
): WeeklyPlanJson {
  if (baselines.length === 0) return plan;
  const byKey = new Map(baselines.map((b) => [b.normalizedKey, b.loadLbs]));
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      const key = normalizeExerciseName(ex.name);
      if (!key) continue;
      const override = byKey.get(key);
      if (override !== undefined) {
        ex.loadLbs = override;
      }
    }
  }
  return plan;
}
