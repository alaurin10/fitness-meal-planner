import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

/**
 * Local-date string in YYYY-MM-DD form. Uses the device's local time so
 * "today" always matches what the user perceives as today.
 */
export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface CompletionRecord {
  id: string;
  planId: string;
  dayKey: string;
  indicesJson: number[];
  completedAt: string | null;
}

/**
 * Tracks which meals the user has completed for a given day.
 * Persisted server-side and keyed by the meal-plan id.
 */
export function useMealCompletions(
  planId: string | undefined,
  dayKey: string,
) {
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ["mealCompletions", planId, dayKey];

  const query = useQuery({
    queryKey,
    enabled: !!planId,
    queryFn: async () => {
      const { data } = await api.get<{ completion: CompletionRecord | null }>(
        `/api/meals/completions?dayKey=${dayKey}`,
      );
      return data.completion;
    },
  });

  const mutation = useMutation({
    mutationFn: async (vars: { indices: number[]; totalMeals: number }) => {
      const { data } = await api.put<{ completion: CompletionRecord }>(
        "/api/meals/completions",
        { planId, dayKey, indices: vars.indices, totalMeals: vars.totalMeals },
      );
      return data.completion;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<CompletionRecord | null>(queryKey);
      qc.setQueryData<CompletionRecord | null>(queryKey, (old) => ({
        id: old?.id ?? "",
        planId: planId ?? "",
        dayKey,
        indicesJson: vars.indices,
        completedAt: old?.completedAt ?? null,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["dailySummary"] });
    },
  });

  const completedIndices: number[] = (query.data?.indicesJson as number[]) ?? [];
  const completed = new Set(completedIndices);

  const toggle = useCallback(
    (index: number, totalMeals = 0) => {
      if (!planId) return;
      const next = [...completedIndices];
      const pos = next.indexOf(index);
      if (pos >= 0) {
        next.splice(pos, 1);
      } else {
        next.push(index);
        next.sort((a, b) => a - b);
      }
      mutation.mutate({ indices: next, totalMeals });
    },
    [planId, completedIndices, mutation],
  );

  const markComplete = useCallback(
    (index: number, totalMeals = 0) => {
      if (!planId) return;
      if (completedIndices.includes(index)) return;
      const next = [...completedIndices, index].sort((a, b) => a - b);
      mutation.mutate({ indices: next, totalMeals });
    },
    [planId, completedIndices, mutation],
  );

  const isComplete = useCallback(
    (index: number) => completed.has(index),
    [completed],
  );

  const isDayComplete = query.data?.completedAt != null;

  return { completed, toggle, markComplete, isComplete, isDayComplete };
}
