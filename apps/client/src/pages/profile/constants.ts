import type { IconName } from "../../components/Icon";
import type {
  EquipmentId,
  MealComplexity,
  ProfileInput,
  WorkoutStyle,
} from "../../hooks/useProfile";

export const EMPTY: ProfileInput = {
  unitSystem: "imperial",
  age: null,
  sex: null,
  weightLbs: null,
  heightIn: null,
  experienceLevel: "beginner",
  trainingDaysPerWeek: 3,
  goal: "build_muscle",
  caloricTarget: null,
  proteinTargetG: null,
  dietaryNotes: null,
  mealComplexity: "varied",
  workoutStyle: "ppl",
  equipment: [],
  hydrationGoal: 8,
  trainingDays: [],
};

export const MEAL_COMPLEXITY: Array<{
  value: MealComplexity;
  label: string;
  hint: string;
  icon: IconName;
}> = [
  {
    value: "varied",
    label: "Creative",
    hint: "Different recipes most days. Lean into variety.",
    icon: "sparkle",
  },
  {
    value: "simple",
    label: "Simple",
    hint: "Quick weeknight meals with short ingredient lists.",
    icon: "leaf",
  },
  {
    value: "prep",
    label: "Meal prep",
    hint: "Reuse a few recipes across the week. Cook in batches.",
    icon: "flame",
  },
];

export const MEAL_COMPLEXITY_LABEL: Record<MealComplexity, string> = {
  varied: "Creative",
  simple: "Simple",
  prep: "Meal prep",
};

export const WORKOUT_STYLES: Array<{
  value: WorkoutStyle;
  label: string;
  hint: string;
  icon: IconName;
}> = [
  {
    value: "ppl",
    label: "PPL / Upper-Lower",
    hint: "Push / Pull / Legs split, or Upper / Lower when training ≤4 days.",
    icon: "dumbbell",
  },
  {
    value: "muscle_group",
    label: "Muscle Groups",
    hint: "Each day targets a primary muscle group — e.g. Chest & Triceps, Back & Biceps.",
    icon: "flame",
  },
];

export const WORKOUT_STYLE_LABEL: Record<WorkoutStyle, string> = {
  ppl: "PPL / Upper-Lower",
  muscle_group: "Muscle Groups",
};

export const EQUIPMENT: Array<{ value: EquipmentId; label: string }> = [
  { value: "barbell", label: "Barbell + plates" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "kettlebells", label: "Kettlebells" },
  { value: "pull_up_bar", label: "Pull-up bar" },
  { value: "bench", label: "Bench" },
  { value: "squat_rack", label: "Squat rack" },
  { value: "cable_machine", label: "Cable machine" },
  { value: "resistance_bands", label: "Resistance bands" },
  { value: "cardio_machine", label: "Cardio machine" },
];

export const EQUIPMENT_LABEL: Record<EquipmentId, string> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.value, e.label]),
) as Record<EquipmentId, string>;

export const EXPERIENCE: Array<[ProfileInput["experienceLevel"], string]> = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
];

export const GOALS: Array<[ProfileInput["goal"], string, IconName]> = [
  ["build_muscle", "Build", "dumbbell"],
  ["lose_fat", "Lean", "flame"],
  ["maintain", "Maintain", "heart"],
];

export const GOAL_LABEL: Record<ProfileInput["goal"], string> = {
  build_muscle: "Build muscle",
  lose_fat: "Lean out",
  maintain: "Maintain",
};

export const GOAL_ICON: Record<ProfileInput["goal"], IconName> = {
  build_muscle: "dumbbell",
  lose_fat: "flame",
  maintain: "heart",
};

export const EXPERIENCE_LABEL: Record<ProfileInput["experienceLevel"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const QUICK_NOTES = [
  "Vegetarian",
  "No dairy",
  "Gluten-free",
  "Low FODMAP",
  "No pork",
  "Pescatarian",
];
