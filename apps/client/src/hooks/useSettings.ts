import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface AppSettings {
  unitSystem: "imperial" | "metric";
  hydrationGoal: number;
}

export function useSettings() {
  const api = useApi();
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await api.get<{ settings: AppSettings }>("/api/settings");
      return data.settings;
    },
  });
}

export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppSettings) => {
      const { data } = await api.patch<{ settings: AppSettings }>("/api/settings", input);
      return data.settings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
