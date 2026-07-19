import type { IconName } from "../../components/Icon";
import type {
  EquipmentId,
  MealComplexity,
  ProfileInput,
  VarietyStrength,
  WorkoutDuration,
  WorkoutStyle,
  WorkoutType,
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
  workoutDuration: 60,
  workoutTypes: ["lifts", "core"],
  workoutVariety: "medium",
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

export const WORKOUT_DURATIONS: ReadonlyArray<{ value: WorkoutDuration; label: string }> = [
  { value: 30, label: "30" },
  { value: 45, label: "45" },
  { value: 60, label: "60" },
  { value: 75, label: "75" },
  { value: 90, label: "90" },
];

export const WORKOUT_TYPE_OPTIONS: ReadonlyArray<{
  value: WorkoutType;
  label: string;
  locked?: boolean;
}> = [
  { value: "lifts", label: "Lifts", locked: true },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
];

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  lifts: "Lifts",
  core: "Core",
  cardio: "Cardio",
};

export const WORKOUT_VARIETY_OPTIONS: ReadonlyArray<{ value: VarietyStrength; label: string }> = [
  { value: "low", label: "Consistent" },
  { value: "medium", label: "Balanced" },
  { value: "high", label: "Fresh" },
];

export const WORKOUT_VARIETY_LABEL: Record<VarietyStrength, string> = {
  low: "Same lifts, steady progression",
  medium: "Balanced rotation",
  high: "New movements every week",
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
