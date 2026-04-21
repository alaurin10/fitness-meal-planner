import type { Profile } from "@platform/db";
import { generateWithRetry, getGeminiClient, stripJsonFences } from "./gemini.js";
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
import type { TrainingSchedule } from "./schedule.js";

export async function generateMealPlan(args: {
  profile: Profile;
  schedule: TrainingSchedule;
}): Promise<MealPlanJson> {
  const text = await generateWithRetry(async (model) => {
    const response = await getGeminiClient().models.generateContent({
      model,
      config: {
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
        systemInstruction: buildSystemPrompt(),
      },
      contents: buildUserPrompt(args),
    });
    if (!response.text) throw new Error("Gemini returned no text content");
    return response.text;
  });

  const raw = stripJsonFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Gemini returned invalid JSON: ${(err as Error).message}\n---\n${raw.slice(0, 500)}`,
    );
  }

  const validated = mealPlanSchema.safeParse(parsed);
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

  const raw = stripJsonFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Gemini returned invalid JSON: ${(err as Error).message}\n---\n${raw.slice(0, 500)}`,
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
