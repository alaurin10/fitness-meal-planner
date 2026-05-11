import type { Profile, ProgressLog, WeeklyPlan } from "@platform/db";
import type { DayLabel } from "@platform/shared";
import { generateWithRetry, getGeminiClient, parseGeminiJson, GenerationSkipError } from "./gemini.js";
import { buildSystemPrompt, buildUserPrompt } from "./workoutPlanPrompt.js";
import { weeklyPlanSchema, type WeeklyPlanJson } from "./workoutPlanSchema.js";

export async function generateWeeklyPlan(args: {
  profile: Profile;
  recentProgress: ProgressLog[];
  previousPlan: WeeklyPlan | null;
  daysToGenerate?: DayLabel[];
}): Promise<WeeklyPlanJson> {
  return generateWithRetry(async (model) => {
    const response = await getGeminiClient().models.generateContent({
      model,
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        systemInstruction: buildSystemPrompt(),
      },
      contents: buildUserPrompt(args),
    });
    if (!response.text) throw new GenerationSkipError("Gemini returned no text content");

    let parsed: unknown;
    try {
      parsed = parseGeminiJson(response.text);
    } catch (err) {
      throw new GenerationSkipError(
        `Gemini returned invalid JSON: ${(err as Error).message}`,
      );
    }

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

    return validated.data;
  });
}
