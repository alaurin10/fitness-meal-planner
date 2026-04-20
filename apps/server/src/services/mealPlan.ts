import type { Profile } from "@platform/db";
import { ANTHROPIC_MODEL, getAnthropicClient, stripJsonFences } from "./anthropic.js";
import { buildSystemPrompt, buildUserPrompt } from "./mealPlanPrompt.js";
import { mealPlanSchema, type MealPlanJson } from "./mealPlanSchema.js";
import type { TrainingSchedule } from "./schedule.js";

export async function generateMealPlan(args: {
  profile: Profile;
  schedule: TrainingSchedule;
}): Promise<MealPlanJson> {
  const response = await getAnthropicClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(args) }],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }

  const raw = stripJsonFences(firstBlock.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Anthropic returned invalid JSON: ${(err as Error).message}\n---\n${raw.slice(0, 500)}`,
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
