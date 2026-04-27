import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export type MealComplexity = "varied" | "simple" | "prep";

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbells",
  "kettlebells",
  "pull_up_bar",
  "bench",
  "squat_rack",
  "cable_machine",
  "resistance_bands",
  "cardio_machine",
] as const;

export type EquipmentId = (typeof EQUIPMENT_OPTIONS)[number];

export interface Profile {
  id: string;
  userId: string;
  unitSystem: "imperial" | "metric";
  age: number | null;
  sex: "male" | "female" | null;
  weightLbs: number | null;
  heightIn: number | null;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  trainingDaysPerWeek: number;
  goal: "build_muscle" | "lose_fat" | "maintain";
  caloricTarget: number | null;
  proteinTargetG: number | null;
  dietaryNotes: string | null;
  mealComplexity: MealComplexity;
  equipment: EquipmentId[];
  updatedAt: string;
}

export interface ProfileInput {
  unitSystem: Profile["unitSystem"];
  age: number | null;
  sex: "male" | "female" | null;
  weightLbs: number | null;
  heightIn: number | null;
  experienceLevel: Profile["experienceLevel"];
  trainingDaysPerWeek: number;
  goal: Profile["goal"];
  caloricTarget?: number | null;
  proteinTargetG?: number | null;
  dietaryNotes?: string | null;
  mealComplexity: MealComplexity;
  equipment: EquipmentId[];
}

export interface SuggestedTargets {
  caloricTarget: number;
  proteinTargetG: number;
}

interface ProfileResponse {
  profile: Profile | null;
  suggested: SuggestedTargets | null;
}

export function useProfile() {
  const api = useApi();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await api.get<ProfileResponse>("/api/profile");
      return data;
    },
  });
}

export function useSaveProfile() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const { data } = await api.put<{
        profile: Profile | null | undefined;
        suggested: SuggestedTargets | null;
      }>("/api/profile", input);
      // Ensure profile exists and has unitSystem
      if (!data || !data.profile) {
        throw new Error("Server did not return a profile");
      }
      return {
        ...data,
        profile: {
          ...data.profile,
          unitSystem: data.profile.unitSystem ?? "imperial",
          mealComplexity: data.profile.mealComplexity ?? "varied",
          equipment: data.profile.equipment ?? [],
        } as Profile,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
