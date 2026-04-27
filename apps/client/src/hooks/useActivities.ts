import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { ActivityLog, ActivityInput } from "../lib/types";

export function useActivities() {
  const api = useApi();
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data } = await api.get<{ logs: ActivityLog[] }>("/api/activities");
      return data.logs;
    },
  });
}

export function useLogActivity() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActivityInput) => {
      const { data } = await api.post<{ log: ActivityLog }>("/api/activities", input);
      return data.log;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteActivity() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/activities/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
