import type { MealProfile } from "@platform/db";
import type { FitSchedule } from "./fitClient.js";

export function buildSystemPrompt(): string {
  return [
    "You are a registered dietitian building a week of meals for a single person.",
    "",
    "Rules:",
    "- Respond with VALID JSON ONLY. No prose before or after.",
    "- The JSON shape must be exactly:",
    "  { summary: string; dailyCalorieTarget: number; days: Array<{ day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'; meals: Array<{ name: string; calories: number; proteinG: number; ingredients: Array<{ name: string; qty: string; category: 'Produce'|'Protein'|'Dairy'|'Pantry'|'Frozen'|'Other' }> }> }> }",
    "- Always include a `category` on each ingredient, chosen from the exact list above.",
    "- Keep ingredient names consistent across meals so quantities can be aggregated.",
    "- Provide 3 meals per day (breakfast, lunch, dinner) unless the user's target clearly needs snacks to hit calories.",
    "- Respect dietary notes strictly.",
  ].join("\n");
}

export function buildUserPrompt(args: {
  profile: MealProfile;
  schedule: FitSchedule;
}): string {
  const { profile, schedule } = args;

  const baseTarget = profile.caloricTarget ?? 2200;
  const trainingDayBonus = schedule.avgDailyCaloriesBurned;
  const suggestedTarget = baseTarget + trainingDayBonus;

  const lines: string[] = [];
  lines.push("Client profile:");
  lines.push(
    JSON.stringify(
      {
        baseCaloricTarget: baseTarget,
        proteinTargetG: profile.proteinTargetG,
        dietaryNotes: profile.dietaryNotes ?? "none",
      },
      null,
      2,
    ),
  );
  lines.push("");
  lines.push("Training schedule from the fitness app (adjust calories accordingly):");
  lines.push(
    JSON.stringify(
      {
        trainingDays: schedule.trainingDays,
        avgDailyCaloriesBurned: schedule.avgDailyCaloriesBurned,
        goal: schedule.goal,
      },
      null,
      2,
    ),
  );
  lines.push("");
  lines.push(
    `Suggested dailyCalorieTarget: ${suggestedTarget}. You may adjust ±150 kcal if it helps macro targets.`,
  );
  lines.push("");
  lines.push("Produce the full 7-day plan as JSON only.");
  return lines.join("\n");
}
