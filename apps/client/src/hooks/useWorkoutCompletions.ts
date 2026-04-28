import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { localDayKey } from "./useMealCompletions";

export { localDayKey };

interface CompletionRecord {
  id: string;
  planId: string;
  dayKey: string;
  setsJson: Record<string, number[]>;
  completedAt: string | null;
}

/**
 * Tracks per-set workout completion, persisted server-side.
 * setsJson maps exercise index → array of completed set numbers (1-based).
 */
export function useWorkoutCompletions(
  planId: string | undefined,
  dayKey: string,
) {
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ["workoutCompletions", planId, dayKey];

  const query = useQuery({
    queryKey,
    enabled: !!planId,
    queryFn: async () => {
      const { data } = await api.get<{ completion: CompletionRecord | null }>(
        `/api/workouts/completions?dayKey=${dayKey}${planId ? `&planId=${planId}` : ""}`,
      );
      return data.completion;
    },
  });

  const mutation = useMutation({
    mutationFn: async (setsJson: Record<string, number[]>) => {
      const { data } = await api.put<{ completion: CompletionRecord }>(
        "/api/workouts/completions",
        { planId, dayKey, setsJson, totalExercises: 0 },
      );
      return data.completion;
    },
    onMutate: async (setsJson) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<CompletionRecord | null>(queryKey);
      qc.setQueryData<CompletionRecord | null>(queryKey, (old) => ({
        id: old?.id ?? "",
        planId: planId ?? "",
        dayKey,
        setsJson,
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

  const setsJson: Record<string, number[]> = (query.data?.setsJson as Record<string, number[]>) ?? {};

  const toggleSet = useCallback(
    (exerciseIdx: number, setNum: number) => {
      if (!planId) return;
      const current = { ...setsJson };
      const key = String(exerciseIdx);
      const sets = [...(current[key] ?? [])];
      const idx = sets.indexOf(setNum);
      if (idx >= 0) {
        sets.splice(idx, 1);
      } else {
        sets.push(setNum);
        sets.sort((a, b) => a - b);
      }
      current[key] = sets;
      mutation.mutate(current);
    },
    [planId, setsJson, mutation],
  );

  const markSetComplete = useCallback(
    (exerciseIdx: number, setNum: number) => {
      if (!planId) return;
      const current = { ...setsJson };
      const key = String(exerciseIdx);
      const sets = [...(current[key] ?? [])];
      if (!sets.includes(setNum)) {
        sets.push(setNum);
        sets.sort((a, b) => a - b);
        current[key] = sets;
        mutation.mutate(current);
      }
    },
    [planId, setsJson, mutation],
  );

  const isSetComplete = useCallback(
    (exerciseIdx: number, setNum: number) => {
      return setsJson[String(exerciseIdx)]?.includes(setNum) ?? false;
    },
    [setsJson],
  );

  const isComplete = query.data?.completedAt != null;

  const completedSetsCount = Object.values(setsJson).reduce(
    (s, arr) => s + arr.length,
    0,
  );

  const markComplete = useCallback(() => {
    // no-op for compatibility — completion is auto-determined server-side
  }, []);

  const toggle = useCallback(() => {
    // no-op for compatibility — completion is auto-determined server-side
  }, []);

  return {
    isComplete,
    markComplete,
    toggle,
    toggleSet,
    markSetComplete,
    isSetComplete,
    setsJson,
    completedSetsCount,
  };
}
