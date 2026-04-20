import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "../lib/api";
import type {
  MealDay,
  RecipeInput,
  RecipeRecord,
  RecipeSource,
} from "../lib/types";

export interface RecipeListFilters {
  search?: string;
  favorite?: boolean;
  source?: RecipeSource;
  tag?: string;
}

export function useRecipes(filters: RecipeListFilters = {}) {
  const api = useApi();
  return useQuery({
    queryKey: ["recipes", "list", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.favorite) params.favorite = "true";
      if (filters.source) params.source = filters.source;
      if (filters.tag) params.tag = filters.tag;
      const { data } = await api.get<{ recipes: RecipeRecord[] }>(
        "/api/recipes",
        { params },
      );
      return data.recipes;
    },
  });
}

export function useRecipe(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["recipes", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<{ recipe: RecipeRecord }>(
        `/api/recipes/${id}`,
      );
      return data.recipe;
    },
  });
}

export function useCreateRecipe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput) => {
      const { data } = await api.post<{ recipe: RecipeRecord }>(
        "/api/recipes",
        input,
      );
      return data.recipe;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: Partial<RecipeInput> & { isFavorite?: boolean };
    }) => {
      const { data } = await api.patch<{ recipe: RecipeRecord }>(
        `/api/recipes/${args.id}`,
        args.input,
      );
      return data.recipe;
    },
    onSuccess: (recipe) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.setQueryData(["recipes", "detail", recipe.id], recipe);
    },
  });
}

export function useDeleteRecipe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/recipes/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useSaveMealAsRecipe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      day: MealDay["day"];
      index: number;
      planId?: string;
    }) => {
      const { data } = await api.post<{ recipe: RecipeRecord }>(
        "/api/recipes/from-meal",
        args,
      );
      return data.recipe;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
