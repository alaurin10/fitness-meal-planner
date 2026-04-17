import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { GroceryList, WeeklyMealPlanRecord } from "../lib/types";

export function useCurrentPlan() {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "plan", "current"],
    queryFn: async () => {
      const { data } = await api.get<{ plan: WeeklyMealPlanRecord | null }>("/api/plans/current");
      return data.plan;
    },
  });
}

export function useGeneratePlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        plan: WeeklyMealPlanRecord;
        groceryList: GroceryList;
      }>("/api/plans/generate");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", "plan"] });
      qc.invalidateQueries({ queryKey: ["meals", "groceries"] });
    },
  });
}
