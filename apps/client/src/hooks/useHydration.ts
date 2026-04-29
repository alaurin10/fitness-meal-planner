import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { localDayKey } from "./useMealCompletions";

/**
 * Returns the user's local dayKey and updates it the moment local midnight
 * passes — so a dashboard left open overnight resets to 0 cups on its own.
 */
function useTodayDayKey(): string {
  const [dayKey, setDayKey] = useState(() => localDayKey());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1,
    );
    const ms = nextMidnight.getTime() - now.getTime();
    const timer = window.setTimeout(() => setDayKey(localDayKey()), ms);
    return () => window.clearTimeout(timer);
  }, [dayKey]);

  return dayKey;
}

export function useHydration() {
  const api = useApi();
  const dayKey = useTodayDayKey();
  return useQuery({
    queryKey: ["hydration", dayKey],
    queryFn: async () => {
      const { data } = await api.get<{ cups: number }>(
        `/api/hydration?dayKey=${dayKey}`,
      );
      return data;
    },
  });
}

export function useLogHydration() {
  const api = useApi();
  const qc = useQueryClient();
  const dayKey = useTodayDayKey();
  const key = ["hydration", dayKey];
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ cups: number }>(
        "/api/hydration/increment",
        { dayKey },
      );
      return data;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ cups: number }>(key);
      qc.setQueryData(key, (old: { cups: number } | undefined) => ({
        cups: (old?.cups ?? 0) + 1,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
