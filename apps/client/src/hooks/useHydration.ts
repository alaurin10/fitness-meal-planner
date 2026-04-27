import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function useHydration() {
  const api = useApi();
  return useQuery({
    queryKey: ["hydration", todayKey()],
    queryFn: async () => {
      const { data } = await api.get<{ cups: number }>("/api/hydration");
      return data;
    },
  });
}

export function useLogHydration() {
  const api = useApi();
  const qc = useQueryClient();
  const key = todayKey();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ cups: number }>("/api/hydration/increment");
      return data;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["hydration", key] });
      const previous = qc.getQueryData<{ cups: number }>(["hydration", key]);
      qc.setQueryData(["hydration", key], (old: { cups: number } | undefined) => ({
        cups: (old?.cups ?? 0) + 1,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["hydration", key], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["hydration", key] });
    },
  });
}
