import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type {
  GroceryList,
  Meal,
  MealDay,
  WeeklyMealPlanRecord,
} from "../lib/types";

interface PlanResult {
  plan: WeeklyMealPlanRecord;
  groceryList: GroceryList;
}

export function useCurrentMealPlan(weekStart?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "current", weekStart ?? "active"],
    queryFn: async () => {
      const params = weekStart ? `?weekStart=${weekStart}` : "";
      const { data } = await api.get<{ plan: WeeklyMealPlanRecord | null }>(
        `/api/meals/current${params}`,
      );
      return data.plan;
    },
  });
}

export function useGenerateMealPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { targetWeekStart?: string }) => {
      const { data } = await api.post<PlanResult>("/api/meals/generate", {
        targetWeekStart: opts?.targetWeekStart,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useCreateEmptyPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { targetWeekStart?: string }) => {
      const { data } = await api.post<PlanResult>("/api/meals/empty", {
        targetWeekStart: opts?.targetWeekStart,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useRegenerateSlot() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; index: number }) => {
      const { data } = await api.post<PlanResult>(
        "/api/meals/slot/regenerate",
        args,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useReplaceSlot() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      day: MealDay["day"];
      index: number;
      meal: Meal;
    }) => {
      const { data } = await api.put<PlanResult>("/api/meals/slot", args);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useAddSlot() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; meal: Meal }) => {
      const { data } = await api.post<PlanResult>(
        "/api/meals/slot/add",
        args,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useDeleteSlot() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; index: number }) => {
      const { data } = await api.delete<PlanResult>("/api/meals/slot", {
        data: args,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}
