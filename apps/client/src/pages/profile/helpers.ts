import type { Profile, ProfileInput } from "../../hooks/useProfile";
import {
  inchesToCm,
  poundsToKg,
  roundTo,
  type UnitSystem,
} from "../../lib/units";

export function profileToForm(profile: Profile): ProfileInput {
  return {
    unitSystem: profile.unitSystem ?? "imperial",
    age: profile.age,
    sex: profile.sex,
    weightLbs: profile.weightLbs,
    heightIn: profile.heightIn,
    experienceLevel: profile.experienceLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    goal: profile.goal,
    caloricTarget: profile.caloricTarget,
    proteinTargetG: profile.proteinTargetG,
    dietaryNotes: profile.dietaryNotes,
    mealComplexity: profile.mealComplexity ?? "varied",
    workoutStyle: profile.workoutStyle ?? "ppl",
    equipment: profile.equipment ?? [],
    hydrationGoal: profile.hydrationGoal ?? 8,
    trainingDays: profile.trainingDays ?? [],
  };
}

export function shouldUseSuggested(savedValue: number | null, suggestedValue?: number | null) {
  if (suggestedValue == null) return savedValue == null;
  return savedValue === suggestedValue;
}

export function isProfileComplete(profile: Profile) {
  return (
    profile.age != null &&
    profile.sex != null &&
    profile.weightLbs != null &&
    profile.heightIn != null
  );
}

export function formatWeightDisplay(weightLbs: number | null, unitSystem: UnitSystem) {
  if (weightLbs == null) return "—";
  if (unitSystem === "metric") {
    return `${roundTo(poundsToKg(weightLbs), 1)} kg`;
  }
  return `${roundTo(weightLbs, 1)} lb`;
}

export function formatHeightDisplay(heightIn: number | null, unitSystem: UnitSystem) {
  if (heightIn == null) return "—";
  if (unitSystem === "metric") {
    return `${roundTo(inchesToCm(heightIn), 1)} cm`;
  }
  const { feet, inches } = toFeetInches(heightIn);
  return `${feet ?? 0}′ ${inches ?? 0}″`;
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toFeetInches(heightIn: number | null) {
  if (heightIn == null) return { feet: null, inches: null };
  const rounded = Math.max(0, Math.round(heightIn));
  return {
    feet: Math.floor(rounded / 12),
    inches: rounded % 12,
  };
}

export function toInches(feet: number | null, inches: number | null) {
  const safeFeet = feet ?? 0;
  const safeInches = inches ?? 0;
  return safeFeet * 12 + safeInches;
}

export function getSaveErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    return error.response.data.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn't save your profile right now.";
}
