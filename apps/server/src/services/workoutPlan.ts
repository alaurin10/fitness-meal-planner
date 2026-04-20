import type { Profile, ProgressLog, WeeklyPlan } from "@platform/db";
import { ANTHROPIC_MODEL, getAnthropicClient, stripJsonFences } from "./anthropic.js";
import { buildSystemPrompt, buildUserPrompt } from "./workoutPlanPrompt.js";
import { weeklyPlanSchema, type WeeklyPlanJson } from "./workoutPlanSchema.js";

export async function generateWeeklyPlan(args: {
  profile: Profile;
  recentProgress: ProgressLog[];
  previousPlan: WeeklyPlan | null;
}): Promise<WeeklyPlanJson> {
  const response = await getAnthropicClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2500,
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

  const validated = weeklyPlanSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Generated plan failed validation: ${validated.error.message}`,
    );
  }
  return validated.data;
}
