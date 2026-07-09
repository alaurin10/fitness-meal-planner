import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { WeekStartDay } from "@platform/shared";
import type { MealDay, MealSlot } from "../lib/types";

/** Recurring meal-schedule template: slots to SKIP per day. */
export type MealScheduleMask = Partial<Record<MealDay["day"], MealSlot[]>>;

export interface AppSettings {
  unitSystem: "imperial" | "metric";
  weekStartDay?: WeekStartDay;
  theme?: "light" | "dark" | "system";
  mealSchedule?: MealScheduleMask;
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
    mutationFn: async (input: Partial<AppSettings>) => {
      const { data } = await api.patch<{ settings: AppSettings }>("/api/settings", input);
      return data.settings;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const previous = qc.getQueryData<AppSettings>(["settings"]);
      if (previous) {
        qc.setQueryData<AppSettings>(["settings"], { ...previous, ...input });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(["settings"], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
