import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { localDayKey } from "./useMealCompletions";
import type { Exercise } from "./useWorkoutPlan";

export { localDayKey };

interface CompletionRecord {
  id: string;
  planId: string;
  dayKey: string;
  setsJson: Record<string, number[]>;
  completedAt: string | null;
}

/**
 * Completed/total sets for a day, computed straight from the server-verified
 * `setsJson` — the single source of truth. Every screen that shows a "done
 * so far" count (Dashboard card, Workouts day summary, the guided
 * walkthrough) should derive it from here rather than from a separately
 * tracked local position, which can silently drift from what's actually
 * been recorded server-side.
 */
export function completionProgress(
  setsJson: Record<string, number[]>,
  exercises: Exercise[],
) {
  const total = exercises.reduce((s, e) => s + e.sets, 0);
  const completed = exercises.reduce((s, e, i) => {
    const done = setsJson[String(i)]?.length ?? 0;
    // Defensive cap: a stale completion count (e.g. after the plan's set
    // count changed) should never push completed past the exercise's total.
    return s + Math.min(done, e.sets);
  }, 0);
  return { completed, total, fraction: total > 0 ? completed / total : 0 };
}

/**
 * The first not-yet-completed set, in exercise order — where the guided
 * walkthrough should resume. Derived from real completions rather than a
 * separately persisted "last position", so it can never point somewhere
 * that disagrees with what's actually been marked done.
 */
export function findResumePosition(
  exercises: Exercise[],
  setsJson: Record<string, number[]>,
): { exerciseIdx: number; setNum: number } | null {
  for (let i = 0; i < exercises.length; i++) {
    const done = setsJson[String(i)] ?? [];
    for (let setNum = 1; setNum <= exercises[i]!.sets; setNum++) {
      if (!done.includes(setNum)) return { exerciseIdx: i, setNum };
    }
  }
  return null;
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
        { planId, dayKey, setsJson },
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

  const unmarkSetComplete = useCallback(
    (exerciseIdx: number, setNum: number) => {
      if (!planId) return;
      const current = { ...setsJson };
      const key = String(exerciseIdx);
      const sets = current[key] ?? [];
      if (sets.includes(setNum)) {
        current[key] = sets.filter((n) => n !== setNum);
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
    unmarkSetComplete,
    isSetComplete,
    setsJson,
    completedSetsCount,
  };
}
