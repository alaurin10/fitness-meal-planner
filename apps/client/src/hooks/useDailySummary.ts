import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { localDayKey } from "./useMealCompletions";

export interface DailySummary {
  workout: {
    completed: number;
    total: number;
    done: boolean;
    isRestDay: boolean;
  };
  meals: {
    completed: number;
    total: number;
    calories: number;
    protein: number;
    done: boolean;
  };
  hydration: {
    cups: number;
    goal: number;
  };
  targets: {
    caloricTarget: number | null;
    proteinTargetG: number | null;
  };
}

export function useDailySummary(dayKey?: string) {
  const api = useApi();
  const dk = dayKey ?? localDayKey();

  return useQuery({
    queryKey: ["dailySummary", dk],
    queryFn: async () => {
      const { data } = await api.get<DailySummary>(
        `/api/progress/daily-summary?dayKey=${dk}`,
      );
      return data;
    },
  });
}
