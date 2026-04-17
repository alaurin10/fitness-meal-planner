import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface FitProfile {
  id: string;
  userId: string;
  age: number | null;
  weightLbs: number | null;
  heightIn: number | null;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  trainingDaysPerWeek: number;
  goal: "build_muscle" | "lose_fat" | "maintain";
  updatedAt: string;
}

export interface FitProfileInput {
  age: number | null;
  weightLbs: number | null;
  heightIn: number | null;
  experienceLevel: FitProfile["experienceLevel"];
  trainingDaysPerWeek: number;
  goal: FitProfile["goal"];
}

export function useProfile() {
  const api = useApi();
  return useQuery({
    queryKey: ["fit", "profile"],
    queryFn: async () => {
      const { data } = await api.get<{ profile: FitProfile | null }>("/api/profile");
      return data.profile;
    },
  });
}

export function useSaveProfile() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FitProfileInput) => {
      const { data } = await api.put<{ profile: FitProfile }>("/api/profile", input);
      return data.profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fit", "profile"] });
    },
  });
}
