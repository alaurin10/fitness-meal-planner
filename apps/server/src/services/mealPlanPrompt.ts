import type { Profile } from "@platform/db";
import type { TrainingSchedule } from "./schedule.js";

export function buildSystemPrompt(): string {
  return [
    "You are a registered dietitian and recipe developer building a week of cookable meals for a single person.",
    "",
    "Rules:",
    "- Respond with VALID JSON ONLY. No prose before or after.",
    "- The JSON shape must be exactly:",
    "  {",
    "    summary: string;",
    "    dailyCalorieTarget: number;",
    "    days: Array<{",
    "      day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';",
    "      meals: Array<{",
    "        name: string;",
    "        slot: 'breakfast'|'lunch'|'dinner'|'snack';",
    "        servings: number;            // integer, usually 1",
    "        prepMinutes: number;         // integer, hands-on prep time",
    "        cookMinutes: number;         // integer, unattended/cook time (0 if none)",
    "        totalMinutes: number;        // integer, prep + cook",
    "        calories: number;            // integer kcal for ONE serving",
    "        proteinG: number;            // integer grams per serving",
    "        carbsG: number;              // integer grams per serving",
    "        fatG: number;                // integer grams per serving",
    "        ingredients: Array<{",
    "          name: string;              // e.g. 'chicken breast' (lowercase, singular when possible)",
    "          quantity: { amount: number; unit: string };",
    "          category: 'Produce'|'Protein'|'Dairy'|'Pantry'|'Frozen'|'Other';",
    "          note?: string;             // optional prep note, e.g. 'diced'",
    "        }>;",
    "        steps: Array<{",
    "          order: number;             // 1-based",
    "          text: string;              // ONE concrete cooking action, imperative voice",
    "          durationMinutes?: number;  // include only when the step actually has a wait/cook time",
    "        }>;",
    "        tags?: string[];             // e.g. ['high-protein','one-pan','vegetarian']",
    "        isLeftover?: boolean;        // true when this meal is leftovers from a previous cook",
    "      }>",
    "    }>;",
    "  }",
    "- Always include a `category` on each ingredient, chosen from the exact list above.",
    "- Use ONLY these units in `quantity.unit`: 'g','kg','oz','lb','ml','L','tsp','tbsp','cup','fl oz','piece','slice','clove','can','pinch','to taste',''.",
    "  Prefer metric weights for proteins/produce ('g','kg') and standard cooking volumes ('tsp','tbsp','cup') for liquids and small amounts. Use 'piece' for whole-item items (eggs, lemons).",
    "  For 'to taste' items use { amount: 0, unit: 'to taste' }.",
    "- Keep ingredient names consistent across meals (lowercase, singular) so quantities can be aggregated for the grocery list.",
    "- Ingredient names must describe the RAW/uncooked form of the item. Do NOT prefix with cooking states such as 'cooked', 'grilled', 'roasted', 'steamed', 'boiled', 'sautéed', 'baked', etc. For example, use 'chicken breast' not 'cooked chicken breast', 'rice' not 'cooked rice'. Preparation/cooking details belong in the recipe steps, not in the ingredient name.",
    "- Steps must be concrete and ordered: each step is one action a cook can follow without re-reading earlier steps. 4–10 steps per meal is typical.",
    "- Provide 3 meals per day (breakfast, lunch, dinner) unless the user's target clearly needs a snack to hit calories. If you add a snack, set slot:'snack'.",
    "- All macros (calories/proteinG/carbsG/fatG) are PER SERVING.",
    "- Respect dietary notes strictly.",
    "- LEFTOVERS: When the meal plan reuses a meal from a previous day as leftovers, mark the leftover entry with `\"isLeftover\": true`. The leftover meal should still have a full ingredients list (same as the original) and steps, but will be excluded from the grocery list. On the ORIGINAL cooking day, set `servings` to the total number of servings needed (e.g. 2 if one serving is eaten that day and one is saved). The ingredient quantities must be PER SERVING (the grocery list will multiply by `servings` automatically). Include a `notes` field like 'Make 2 servings — save 1 for [Day] [slot].' so the user knows not to eat everything.",
  ].join("\n");
}

const COMPLEXITY_GUIDANCE: Record<string, string> = {
  varied:
    "STYLE: Lean toward varied, creative meals — different recipes most days, with some shared ingredients to keep the grocery list manageable. The user enjoys cooking new things.",
  simple:
    "STYLE: Keep meals simple and quick to prepare — short ingredient lists, common pantry staples, minimal active cooking time. Prefer recipes the user can throw together on a busy weeknight.",
  prep:
    "STYLE: Prioritize meal prep and batch cooking — REUSE the same lunch and dinner recipes across at least 3-4 days of the week. Aim for ~3 distinct dinners and 2-3 distinct lunches max for the whole week, scaled up to multiple servings each. Breakfasts and snacks may also repeat. The user wants to cook a few large batches and eat the leftovers.",
};

export function buildUserPrompt(args: {
  profile: Profile;
  schedule: TrainingSchedule;
}): string {
  const { profile, schedule } = args;

  const baseTarget = profile.caloricTarget ?? 2200;
  const trainingDayBonus = schedule.avgDailyCaloriesBurned;
  const suggestedTarget = baseTarget + trainingDayBonus;
  const complexity = profile.mealComplexity ?? "varied";

  const lines: string[] = [];
  lines.push("Client profile:");
  lines.push(
    JSON.stringify(
      {
        baseCaloricTarget: baseTarget,
        proteinTargetG: profile.proteinTargetG,
        dietaryNotes: profile.dietaryNotes ?? "none",
        mealComplexity: complexity,
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
    COMPLEXITY_GUIDANCE[complexity] ?? COMPLEXITY_GUIDANCE.varied!,
  );
  lines.push("");
  lines.push(
    `Suggested dailyCalorieTarget: ${suggestedTarget}. You may adjust ±150 kcal if it helps macro targets.`,
  );
  lines.push("");
  lines.push("Produce the full 7-day plan as JSON only.");
  return lines.join("\n");
}

export function buildSingleMealSystemPrompt(): string {
  return [
    "You are a registered dietitian and recipe developer creating ONE replacement meal for a single person.",
    "",
    "Rules:",
    "- Respond with VALID JSON ONLY. No prose before or after.",
    "- The JSON must be a single meal object with EXACTLY this shape:",
    "  {",
    "    name: string;",
    "    slot: 'breakfast'|'lunch'|'dinner'|'snack';",
    "    servings: number;            // integer, usually 1",
    "    prepMinutes: number;         // integer",
    "    cookMinutes: number;         // integer (0 if none)",
    "    totalMinutes: number;        // integer",
    "    calories: number;            // integer kcal PER SERVING",
    "    proteinG: number;            // integer grams PER SERVING",
    "    carbsG: number;              // integer grams PER SERVING",
    "    fatG: number;                // integer grams PER SERVING",
    "    ingredients: Array<{ name, quantity:{amount:number,unit:string}, category:'Produce'|'Protein'|'Dairy'|'Pantry'|'Frozen'|'Other', note?:string }>;",
    "    steps: Array<{ order:number, text:string, durationMinutes?:number }>;",
    "    tags?: string[];",
    "  }",
    "- Use ONLY these units: 'g','kg','oz','lb','ml','L','tsp','tbsp','cup','fl oz','piece','slice','clove','can','pinch','to taste',''.",
    "- Lowercase singular ingredient names so they aggregate cleanly with other meals.",
    "- Ingredient names must describe the RAW/uncooked form (e.g. 'chicken breast' not 'cooked chicken breast').",
    "- 4–10 concrete imperative steps.",
    "- Respect dietary notes and the requested slot exactly.",
  ].join("\n");
}

export function buildSingleMealUserPrompt(args: {
  profile: Profile;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  targetCalories?: number;
  targetProteinG?: number;
  avoidNames?: string[];
}): string {
  const lines: string[] = [];
  lines.push("Client profile:");
  lines.push(
    JSON.stringify(
      {
        dietaryNotes: args.profile.dietaryNotes ?? "none",
        proteinTargetG: args.profile.proteinTargetG,
      },
      null,
      2,
    ),
  );
  lines.push("");
  lines.push(`Slot: ${args.slot}`);
  if (args.targetCalories) {
    lines.push(`Target calories for this meal: ~${args.targetCalories} kcal (±100).`);
  }
  if (args.targetProteinG) {
    lines.push(`Target protein for this meal: ~${args.targetProteinG} g (±10).`);
  }
  if (args.avoidNames && args.avoidNames.length > 0) {
    lines.push(
      `Avoid recipes that resemble: ${args.avoidNames.join(", ")}.`,
    );
  }
  lines.push("");
  lines.push("Return ONE meal as JSON only.");
  return lines.join("\n");
}
