import type {
  Profile,
  ProgressLog,
  UserExerciseBaseline,
  WeeklyPlan,
} from "@platform/db";
import type { DayLabel } from "@platform/shared";

export function buildSystemPrompt(): string {
  return [
    "You are an expert strength and conditioning coach.",
    "You design weekly training programs that respect the athlete's established working weights. Weight progression is user-driven, not coach-driven.",
    "",
    "Rules:",
    "- Respond with VALID JSON ONLY. No prose before or after.",
    "- The JSON must match this TypeScript type exactly:",
    "  { summary: string; progressionNotes: string; days: Array<{ day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'; focus: string; exercises: Array<{ name: string; muscleGroup: string; description: string; sets: number; reps: string; loadLbs: number | null; restSeconds: number; notes?: string }> }> }",
    "- `muscleGroup` is the primary muscle group the exercise targets (e.g. 'Chest', 'Back', 'Quads', 'Core'). Use one concise label.",
    "- `description` is 1-2 sentences explaining how to perform the exercise (stance, grip, motion cues).",
    "- `reps` is a string like '8-10' or '5'. For timed/isometric work (planks, holds, carries, wall sits), use a canonical duration format: '45s', '90s', or '45s per side' for unilateral holds. Never write 'seconds', 'sec', minutes, or duration ranges in `reps`.",
    "- `loadLbs` rules:",
    "  - If the exercise (matched by name, case-insensitive, ignoring qualifiers like 'barbell'/'dumbbell') appears in `userBaselines`, you MUST set `loadLbs` to that exact value. Do not apply any progression on top.",
    "  - Otherwise, set `loadLbs` to a reasonable starting weight for the athlete's experience level. Use null for bodyweight movements.",
    "  - Do NOT invent week-over-week weight increases. The user controls progression.",
    "- Prefer exercise names that match the athlete's existing baselines so progression carries forward across weeks. If you must introduce a new variation, give it a clearly distinct name.",
    "- Include 1-2 core / ab exercises at the END of every training day.",
    "- `summary` is one paragraph describing the week's focus (movement patterns, volume, intent) — NOT weight changes.",
    "- `progressionNotes` is one paragraph noting variety or focus shifts from the previous week. Do not claim to have changed weights; weight changes only happen when the athlete logs them.",
    "- Only include as many day entries as specified by the caller (see daysToGenerate).",
    "- STRICTLY respect the athlete's available equipment. Only prescribe exercises that can be performed with the listed equipment. If equipment is empty, the athlete has bodyweight only — design a fully bodyweight program.",
  ].join("\n");
}

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell with plates",
  dumbbells: "Dumbbells (adjustable or full set)",
  kettlebells: "Kettlebells",
  pull_up_bar: "Pull-up bar",
  bench: "Adjustable bench",
  squat_rack: "Squat rack / power rack",
  cable_machine: "Cable machine / lat pulldown",
  resistance_bands: "Resistance bands",
  cardio_machine: "Cardio machine (treadmill, bike, or rower)",
};

function describeEquipment(equipment: string[] | null | undefined): string {
  if (!equipment || equipment.length === 0) {
    return "BODYWEIGHT ONLY — no equipment available. Use only bodyweight movements (push-ups, pull-ups only if a bar is listed, lunges, squats, planks, etc.).";
  }
  const lines = equipment
    .map((id) => EQUIPMENT_LABELS[id])
    .filter((v): v is string => Boolean(v));
  return [
    "Available equipment (use only these):",
    ...lines.map((label) => `- ${label}`),
  ].join("\n");
}

export function buildUserPrompt(args: {
  profile: Profile;
  recentProgress: ProgressLog[];
  previousPlan: WeeklyPlan | null;
  baselines: UserExerciseBaseline[];
  daysToGenerate?: DayLabel[];
}): string {
  const { profile, recentProgress, previousPlan, baselines } = args;

  const workoutStyle = (profile as Profile & { workoutStyle?: string }).workoutStyle ?? "ppl";

  const profileBlock = {
    age: profile.age,
    weightLbs: profile.weightLbs,
    heightIn: profile.heightIn,
    experienceLevel: profile.experienceLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    goal: profile.goal,
    workoutStyle,
    equipment: profile.equipment ?? [],
  };

  const baselineBlock: Record<string, number> = {};
  for (const b of baselines) {
    baselineBlock[b.exerciseName] = b.loadLbs;
  }

  const progressBlock = recentProgress.map((p) => ({
    loggedAt: p.loggedAt.toISOString().slice(0, 10),
    weightLbs: p.weightLbs,
    note: p.note,
  }));

  const lines: string[] = [];
  lines.push("Athlete profile:");
  lines.push(JSON.stringify(profileBlock, null, 2));
  lines.push("");
  lines.push(
    Object.keys(baselineBlock).length === 0
      ? "userBaselines: (none — athlete hasn't set any working weights yet)"
      : "userBaselines (exact weights the athlete has chosen — DO NOT modify these):",
  );
  if (Object.keys(baselineBlock).length > 0) {
    lines.push(JSON.stringify(baselineBlock, null, 2));
  }
  lines.push("");
  lines.push(
    progressBlock.length === 0
      ? "Recent body-weight / notes (past 4 weeks): (none)"
      : "Recent body-weight / notes (past 4 weeks, context only):",
  );
  if (progressBlock.length > 0) {
    lines.push(JSON.stringify(progressBlock, null, 2));
  }
  lines.push("");
  lines.push(describeEquipment(profile.equipment));
  lines.push("");
  if (workoutStyle === "ppl") {
    lines.push(
      "Workout style: Push / Pull / Legs. For 4 or fewer training days, use an Upper / Lower split instead. The `focus` field should reflect the PPL or Upper/Lower category (e.g. 'Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body').",
    );
  } else {
    lines.push(
      "Workout style: Muscle Groups. Structure each training day around a primary muscle group (e.g. 'Chest & Triceps', 'Back & Biceps', 'Shoulders & Arms', 'Legs'). The `focus` field should name the targeted muscle groups.",
    );
  }
  lines.push("");
  if (previousPlan) {
    lines.push("Previous plan (keep movement selection coherent — do not regress quality):");
    lines.push(JSON.stringify(previousPlan.planJson, null, 2));
  } else {
    lines.push("Previous plan: (none)");
  }
  lines.push("");
  if (args.daysToGenerate && args.daysToGenerate.length < 7) {
    lines.push(
      `Produce a plan with day entries EXACTLY matching this set, in this order: ${args.daysToGenerate.join(", ")}. The "days" array must contain exactly ${args.daysToGenerate.length} entries with these exact day labels. Output JSON only.`,
    );
  } else {
    lines.push(
      `Produce this week's plan for ${profile.trainingDaysPerWeek} training days. Output JSON only.`,
    );
  }
  return lines.join("\n");
}
