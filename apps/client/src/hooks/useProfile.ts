import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

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
        profile: Profile;
        suggested: SuggestedTargets | null;
      }>("/api/profile", input);
      // Ensure unitSystem is present (fallback to imperial if missing)
      return {
        ...data,
        profile: {
          ...data.profile,
          unitSystem: data.profile.unitSystem ?? "imperial",
        },
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
