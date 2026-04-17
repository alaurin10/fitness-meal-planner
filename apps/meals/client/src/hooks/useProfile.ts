import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { MealProfile, MealProfileInput } from "../lib/types";

export function useProfile() {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "profile"],
    queryFn: async () => {
      const { data } = await api.get<{ profile: MealProfile | null }>("/api/profile");
      return data.profile;
    },
  });
}

export function useSaveProfile() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MealProfileInput) => {
      const { data } = await api.put<{ profile: MealProfile }>("/api/profile", input);
      return data.profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", "profile"] });
    },
  });
}
