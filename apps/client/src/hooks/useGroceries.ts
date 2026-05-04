import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type { GroceryCategory, GroceryItem, GroceryList } from "../lib/types";
import type { WeekKey } from "./useMealPlan";

export function useGroceries(week: WeekKey = "current") {
  const api = useApi();
  return useQuery({
    queryKey: ["groceries", week],
    queryFn: async () => {
      const { data } = await api.get<{ list: GroceryList | null }>(
        `/api/groceries/current?week=${week}`,
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

export function useToggleItem(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ["groceries", week] as const;
  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const { data } = await api.patch<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}?week=${week}`,
        { checked },
      );
      return data.list;
    },
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<GroceryList | null>(queryKey);
      if (prev) {
        qc.setQueryData<GroceryList>(queryKey, {
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
        qc.setQueryData(queryKey, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateGroceryItem(week: WeekKey = "current") {
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
        `/api/groceries/items/${itemId}?week=${week}`,
        patch,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}

export function useAddGroceryItem(week: WeekKey = "current") {
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
        `/api/groceries/items?week=${week}`,
        input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}

export function useDeleteGroceryItem(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete<{ list: GroceryList }>(
        `/api/groceries/items/${itemId}?week=${week}`,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}

export function useRebuildGroceries(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        `/api/groceries/rebuild?week=${week}`,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}

export function useClearChecked(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        `/api/groceries/clear-checked?week=${week}`,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}

export function usePushToReminders(week: WeekKey = "current") {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ list: GroceryList }>(
        `/api/groceries/push?week=${week}`,
      );
      return data.list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groceries", week] });
    },
  });
}
