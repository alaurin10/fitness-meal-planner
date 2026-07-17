import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PageHero } from "../components/Primitives";
import { RecipeCard } from "../components/RecipeCard";
import {
  RecipeFilterChips,
  isCategory,
  type FilterPreset,
} from "../components/RecipeFilterChips";
import { SkeletonList } from "../components/Skeleton";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useRecipes, type RecipeListFilters } from "../hooks/useRecipes";

export function RecipesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("all");
  const debouncedSearch = useDebouncedValue(search);

  const filters: RecipeListFilters = {
    search: debouncedSearch.trim() || undefined,
    favorite: preset === "favorites" ? true : undefined,
    category: isCategory(preset) ? preset : undefined,
  };
  const { data: recipes, isLoading } = useRecipes(filters);

  return (
    <Layout>
      <PageHero
        title="Recipe book"
        subtitle="Your saved meals, ready to plan or cook."
        right={
          <Button
            variant="accent"
            onClick={() => navigate("/recipes/new")}
            aria-label="Add recipe"
          >
            <Icon name="plus" size={16} />
          </Button>
        }
      />

      <div className="px-4 pt-2">
        <input
          className="field-input"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <RecipeFilterChips value={preset} onChange={setPreset} />

      <div className="px-4 pt-3 space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 stagger-in">
        {isLoading && (
          <div className="md:col-span-2">
            <SkeletonList count={4} />
          </div>
        )}
        {!isLoading && (recipes?.length ?? 0) === 0 && (
          <div className="md:col-span-2">
            <EmptyState
              illustration="no-recipes"
              title="Nothing saved yet"
              body="Add a recipe by hand, or open a meal you love from your plan and tap “Save to recipe book.”"
            >
              <Button
                variant="accent"
                className="mt-3"
                onClick={() => navigate("/recipes/new")}
              >
                <Icon name="plus" size={14} />
                Add a recipe
              </Button>
            </EmptyState>
          </div>
        )}

        {recipes?.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onSelect={() => navigate(`/recipes/${r.id}`)}
          />
        ))}
      </div>
    </Layout>
  );
}
