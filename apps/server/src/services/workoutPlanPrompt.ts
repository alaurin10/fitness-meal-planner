import type { Profile, ProgressLog, WeeklyPlan } from "@platform/db";
import type { DayLabel } from "@platform/shared";

export function buildSystemPrompt(): string {
  return [
    "You are an expert strength and conditioning coach.",
    "You design weekly training programs that apply progressive overload intelligently based on the athlete's goal, experience, and recent history.",
    "",
    "Rules:",
    "- Respond with VALID JSON ONLY. No prose before or after.",
    "- The JSON must match this TypeScript type exactly:",
    "  { summary: string; progressionNotes: string; days: Array<{ day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'; focus: string; exercises: Array<{ name: string; muscleGroup: string; description: string; sets: number; reps: string; loadLbs: number | null; restSeconds: number; notes?: string }> }> }",
    "- `muscleGroup` is the primary muscle group the exercise targets (e.g. 'Chest', 'Back', 'Quads', 'Core'). Use one concise label.",
    "- `description` is 1-2 sentences explaining how to perform the exercise (stance, grip, motion cues).",
    "- `reps` is a string like '8-10' or '5'.",
    "- `loadLbs` is a recommended working load. Use null for bodyweight. For bar lifts, anchor to the athlete's most recent PR if provided.",
    "- Include 1-2 core / ab exercises at the END of every training day.",
    "- `summary` is one paragraph explaining the week's focus.",
    "- `progressionNotes` is one paragraph explaining what changed from the previous week and why.",
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
  daysToGenerate?: DayLabel[];
}): string {
  const { profile, recentProgress, previousPlan } = args;

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

  const progressBlock = recentProgress.map((p) => ({
    loggedAt: p.loggedAt.toISOString().slice(0, 10),
    weightLbs: p.weightLbs,
    liftPRs: p.liftPRs,
    note: p.note,
  }));

  const lines: string[] = [];
  lines.push("Athlete profile:");
  lines.push(JSON.stringify(profileBlock, null, 2));
  lines.push("");
  lines.push(
    recentProgress.length === 0
      ? "Progress logs from the past 4 weeks: (none — this is the first generated plan)"
      : "Progress logs from the past 4 weeks:",
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
    lines.push("Previous plan (evolve this, do not restart):");
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
