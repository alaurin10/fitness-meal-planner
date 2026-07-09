import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type {
  GroceryList,
  Meal,
  MealDay,
  MealSlot,
  WeeklyMealPlanRecord,
} from "../lib/types";

export interface AffectedLeftover {
  day: MealDay["day"];
  index: number;
  name: string;
  sourceName: string;
  /** Slot of the replaced source meal — locates its successor in the new plan. */
  sourceSlot?: string;
}

export interface PlanResult {
  plan: WeeklyMealPlanRecord;
  groceryList: GroceryList;
  /** Leftover meals that depended on a meal this mutation replaced. */
  affectedLeftovers?: AffectedLeftover[];
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
    mutationFn: async (opts?: {
      targetWeekStart?: string;
      /** One-off slot mask overriding the stored schedule template. */
      skipSlots?: Record<string, string[]>;
    }) => {
      const { data } = await api.post<PlanResult>("/api/meals/generate", {
        targetWeekStart: opts?.targetWeekStart,
        skipSlots: opts?.skipSlots,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["groceries"] });
    },
  });
}

export interface PlanWeekCellInput {
  day: MealDay["day"];
  slot: MealSlot;
  mode: "generate" | "recipe" | "keep" | "skip";
  recipeId?: string;
}

export function usePlanWeek() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      targetWeekStart?: string;
      cells: PlanWeekCellInput[];
      suggestion?: string;
    }) => {
      const { data } = await api.post<PlanResult>("/api/meals/plan-week", args);
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.targetWeekStart) {
        qc.setQueryData(["meals", "current", variables.targetWeekStart], data.plan);
      }
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
    mutationFn: async (args: {
      day: MealDay["day"];
      index: number;
      weekStart?: string;
      suggestion?: string;
    }) => {
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

export function useRegenerateDay() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      day: MealDay["day"];
      weekStart?: string;
      suggestion?: string;
    }) => {
      const { data } = await api.post<PlanResult>(
        "/api/meals/regenerate-day",
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
      weekStart?: string;
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
    mutationFn: async (args: {
      day: MealDay["day"];
      meal: Meal;
      weekStart?: string;
    }) => {
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

export function useResolveLeftovers() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      weekStart?: string;
      source: { day: MealDay["day"]; index: number };
      cells: Array<{ day: MealDay["day"]; index: number }>;
      action: "update" | "regenerate";
    }) => {
      const { data } = await api.post<PlanResult>(
        "/api/meals/leftovers/resolve",
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
    mutationFn: async (args: {
      day: MealDay["day"];
      index: number;
      weekStart?: string;
    }) => {
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
