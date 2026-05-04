import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type {
  GroceryList,
  Meal,
  MealDay,
  WeeklyMealPlanRecord,
} from "../lib/types";

export type WeekKey = "current" | "next";

interface PlanResult {
  plan: WeeklyMealPlanRecord;
  groceryList: GroceryList;
}

export function useCurrentMealPlan(week: WeekKey = "current") {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "current", week],
    queryFn: async () => {
      const { data } = await api.get<{ plan: WeeklyMealPlanRecord | null }>(
        `/api/meals/current?week=${week}`,
      );
      return data.plan;
    },
  });
}

export function useGenerateMealPlan(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<PlanResult>("/api/meals/generate", {
        week,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useCreateEmptyPlan(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<PlanResult>("/api/meals/empty", { week });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useRegenerateSlot(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; index: number }) => {
      const { data } = await api.post<PlanResult>(
        "/api/meals/slot/regenerate",
        { ...args, week },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useReplaceSlot(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      day: MealDay["day"];
      index: number;
      meal: Meal;
    }) => {
      const { data } = await api.put<PlanResult>("/api/meals/slot", {
        ...args,
        week,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useAddSlot(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; meal: Meal }) => {
      const { data } = await api.post<PlanResult>("/api/meals/slot/add", {
        ...args,
        week,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export function useDeleteSlot(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { day: MealDay["day"]; index: number }) => {
      const { data } = await api.delete<PlanResult>("/api/meals/slot", {
        data: { ...args, week },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}
