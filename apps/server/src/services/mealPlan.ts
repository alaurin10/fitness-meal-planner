import type { Profile } from "@platform/db";
import { GEMINI_MODEL, getGeminiClient, stripJsonFences } from "./gemini.js";
import { buildSystemPrompt, buildUserPrompt } from "./mealPlanPrompt.js";
import { mealPlanSchema, type MealPlanJson } from "./mealPlanSchema.js";
import type { TrainingSchedule } from "./schedule.js";

export async function generateMealPlan(args: {
  profile: Profile;
  schedule: TrainingSchedule;
}): Promise<MealPlanJson> {
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    config: {
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
      systemInstruction: buildSystemPrompt(),
    },
    contents: buildUserPrompt(args),
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no text content");
  }

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
