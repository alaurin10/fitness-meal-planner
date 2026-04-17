import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { GroceryList } from "../lib/types";

export function useGroceries() {
  const api = useApi();
  return useQuery({
    queryKey: ["meals", "groceries"],
    queryFn: async () => {
      const { data } = await api.get<{ list: GroceryList | null }>("/api/groceries/current");
      return data.list;
    },
  });
}

export function useToggleItem() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const { data } = await api.patch<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}`,
        { checked },
      );
      return data.list;
    },
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey: ["meals", "groceries"] });
      const prev = qc.getQueryData<GroceryList | null>(["meals", "groceries"]);
      if (prev) {
        qc.setQueryData<GroceryList>(["meals", "groceries"], {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, checked } : i,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["meals", "groceries"], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["meals", "groceries"] });
    },
  });
}

export function useClearChecked() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        "/api/groceries/clear-checked",
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", "groceries"] });
    },
  });
}

export function usePushToReminders() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>("/api/groceries/push");
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", "groceries"] });
    },
  });
}
