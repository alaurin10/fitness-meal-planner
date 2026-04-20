import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface ProgressLog {
  id: string;
  userId: string;
  loggedAt: string;
  weightLbs: number | null;
  note: string | null;
  liftPRs: Record<string, number> | null;
}

export interface ProgressInput {
  weightLbs?: number | null;
  note?: string;
  liftPRs?: Record<string, number>;
}

export function useProgress() {
  const api = useApi();
  return useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const { data } = await api.get<{ logs: ProgressLog[] }>("/api/progress");
      return data.logs;
    },
  });
}

export function useLogProgress() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProgressInput) => {
      const { data } = await api.post<{ log: ProgressLog }>("/api/progress", input);
      return data.log;
    },
    onSuccess: (_log, variables) => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      // When a weight is logged, the server syncs it to the profile (and
      // recomputes calorie/protein targets if still on suggested), so the
      // profile cache needs to refetch.
      if (variables.weightLbs != null) {
        qc.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });
}
