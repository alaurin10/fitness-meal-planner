import type { Profile } from "@platform/db";
import type { DayLabel } from "@platform/shared";
import { generateWithRetry, getGeminiClient, parseGeminiJson } from "./gemini.js";
import {
  buildSingleMealSystemPrompt,
  buildSingleMealUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./mealPlanPrompt.js";
import {
  mealPlanSchema,
  mealSchema,
  type MealJson,
  type MealPlanJson,
} from "./mealPlanSchema.js";
import { normalizeMealPlan } from "./mealPlanNormalizer.js";
import type { TrainingSchedule } from "./schedule.js";

export async function generateMealPlan(args: {
  profile: Profile;
  schedule: TrainingSchedule;
  daysToGenerate?: DayLabel[];
}): Promise<MealPlanJson> {
  const text = await generateWithRetry(async (model) => {
    const response = await getGeminiClient().models.generateContent({
      model,
      config: {
        maxOutputTokens: 32768,
        responseMimeType: "application/json",
        systemInstruction: buildSystemPrompt(),
      },
      contents: buildUserPrompt(args),
    });
    if (!response.text) throw new Error("Gemini returned no text content");
    return response.text;
  });

  let parsed: unknown;
  try {
    parsed = parseGeminiJson(text);
  } catch (err) {
    throw new Error(
      `Gemini returned invalid JSON: ${(err as Error).message}\n---\n${text.slice(0, 500)}`,
    );
  }

  const validated = mealPlanSchema.safeParse(normalizeMealPlan(parsed));
  if (!validated.success) {
    throw new Error(
      `Generated meal plan failed validation: ${validated.error.message}`,
    );
  }
  return validated.data;
}

export async function generateSingleMeal(args: {
  profile: Profile;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  targetCalories?: number;
  targetProteinG?: number;
  avoidNames?: string[];
}): Promise<MealJson> {
  const text = await generateWithRetry(async (model) => {
    const response = await getGeminiClient().models.generateContent({
      model,
      config: {
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        systemInstruction: buildSingleMealSystemPrompt(),
      },
      contents: buildSingleMealUserPrompt(args),
    });
    if (!response.text) throw new Error("Gemini returned no text content");
    return response.text;
  });

  let parsed: unknown;
  try {
    parsed = parseGeminiJson(text);
  } catch (err) {
    throw new Error(
      `Gemini returned invalid JSON: ${(err as Error).message}\n---\n${text.slice(0, 500)}`,
    );
  }

  const validated = mealSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Generated meal failed validation: ${validated.error.message}`,
    );
  }
  return validated.data;
}
