import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface StreakResult {
  current: number;
  best: number;
}

export interface StreaksData {
  workout: StreakResult;
  meals: StreakResult;
  hydration: StreakResult;
  overall: StreakResult;
}

export function useStreaks() {
  const api = useApi();

  return useQuery({
    queryKey: ["streaks"],
    queryFn: async () => {
      const { data } = await api.get<StreaksData>("/api/progress/streaks");
      return data;
    },
  });
}
