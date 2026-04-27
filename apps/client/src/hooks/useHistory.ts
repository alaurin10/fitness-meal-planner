import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface DayRecord {
  workout: { completed: number; total: number; done: boolean };
  meals: { completed: number; total: number; calories: number; protein: number; done: boolean };
  hydration: { cups: number; goal: number; done: boolean };
}

export interface HistoryResponse {
  days: Record<string, DayRecord>;
  targets: { caloricTarget: number | null; proteinTargetG: number | null };
}

export function useHistory(from: string, to: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["history", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data } = await api.get<HistoryResponse>(
        `/api/progress/history?from=${from}&to=${to}`,
      );
      return data;
    },
  });
}
