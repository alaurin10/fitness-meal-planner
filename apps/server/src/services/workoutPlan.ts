import type { Profile, ProgressLog, WeeklyPlan } from "@platform/db";
import { generateWithRetry, getGeminiClient, parseGeminiJson } from "./gemini.js";
import { buildSystemPrompt, buildUserPrompt } from "./workoutPlanPrompt.js";
import { weeklyPlanSchema, type WeeklyPlanJson } from "./workoutPlanSchema.js";

export async function generateWeeklyPlan(args: {
  profile: Profile;
  recentProgress: ProgressLog[];
  previousPlan: WeeklyPlan | null;
}): Promise<WeeklyPlanJson> {
  const text = await generateWithRetry(async (model) => {
    const response = await getGeminiClient().models.generateContent({
      model,
      config: {
        maxOutputTokens: 8192,
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

  const validated = weeklyPlanSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Generated plan failed validation: ${validated.error.message}`,
    );
  }
  return validated.data;
}
