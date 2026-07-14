import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface DayRecord {
  workout: { completed: number; total: number; done: boolean; volumeLbs: number };
  meals: { completed: number; total: number; calories: number; protein: number; done: boolean };
  hydration: { cups: number; goal: number; done: boolean };
  /** Wearable metrics synced from Garmin; null when no connection/data. */
  garmin: {
    steps: number | null;
    totalKilocalories: number | null;
    activeKilocalories: number | null;
    restingHeartRate: number | null;
    sleepSeconds: number | null;
  } | null;
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
