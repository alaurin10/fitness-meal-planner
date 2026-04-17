import Anthropic from "@anthropic-ai/sdk";
import type { MealProfile } from "@platform/db";
import type { FitSchedule } from "./fitClient.js";
import { buildSystemPrompt, buildUserPrompt } from "./mealPrompt.js";
import { mealPlanSchema, type MealPlanJson } from "./mealPlanSchema.js";

const MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateMealPlan(args: {
  profile: MealProfile;
  schedule: FitSchedule;
}): Promise<MealPlanJson> {
  const response = await getClient().messages.create({
    model: MODEL,
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

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}
