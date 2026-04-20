import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { GroceryList, WeeklyMealPlanRecord } from "../lib/types";

export function useCurrentMealPlan() {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "current"],
    queryFn: async () => {
      const { data } = await api.get<{ plan: WeeklyMealPlanRecord | null }>("/api/meals/current");
      return data.plan;
    },
  });
}

export function useGenerateMealPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        plan: WeeklyMealPlanRecord;
        groceryList: GroceryList;
      }>("/api/meals/generate");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}
