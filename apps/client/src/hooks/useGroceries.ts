import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { GroceryCategory, GroceryItem, GroceryList } from "../lib/types";

function weekParam(weekStart?: string) {
  return weekStart ? `?weekStart=${weekStart}` : "";
}

export function useGroceries(weekStart?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["groceries", weekStart ?? "current"],
    queryFn: async () => {
      const { data } = await api.get<{ list: GroceryList | null }>(
        `/api/groceries/current${weekParam(weekStart)}`,
      );
      return data.list;
    },
  });
}

export interface GroceryItemPatch {
  checked?: boolean;
  name?: string;
  qty?: string;
  category?: GroceryCategory;
  note?: string;
}

export function useToggleItem(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  const cacheKey = ["groceries", weekStart ?? "current"];
  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const { data } = await api.patch<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}${weekParam(weekStart)}`,
        { checked },
      );
      return data.list;
    },
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey: cacheKey });
      const prev = qc.getQueryData<GroceryList | null>(cacheKey);
      if (prev) {
        qc.setQueryData<GroceryList>(cacheKey, {
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
        qc.setQueryData(cacheKey, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cacheKey });
    },
  });
}

export function useUpdateGroceryItem(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      patch,
    }: {
      itemId: string;
      patch: GroceryItemPatch;
    }) => {
      const { data } = await api.patch<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}${weekParam(weekStart)}`,
        patch,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}

export function useAddGroceryItem(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      qty?: string;
      // Omit `category` to let the server auto-classify from the item name.
      category?: GroceryCategory;
      note?: string;
    }) => {
      const { data } = await api.post<{ list: GroceryList; item: GroceryItem }>(
        "/api/groceries/items",
        { ...input, weekStart },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}

export function useDeleteGroceryItem(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}${weekParam(weekStart)}`,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}

export function useRebuildGroceries(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        "/api/groceries/rebuild",
        { weekStart },
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}

export function useClearChecked(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        "/api/groceries/clear-checked",
        { weekStart },
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}

export function usePushToReminders(weekStart?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        "/api/groceries/push",
        { weekStart },
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", weekStart ?? "current"] });
    },
  });
}
