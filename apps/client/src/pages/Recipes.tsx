import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { RecipeCard } from "../components/RecipeCard";
import {
  RecipeFilterChips,
  isCategory,
  type FilterPreset,
} from "../components/RecipeFilterChips";
import { SkeletonList } from "../components/Skeleton";
import { useRecipes, type RecipeListFilters } from "../hooks/useRecipes";

export function RecipesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("all");

  const filters: RecipeListFilters = {
    search: search.trim() || undefined,
    favorite: preset === "favorites" ? true : undefined,
    category: isCategory(preset) ? preset : undefined,
  };
  const { data: recipes, isLoading } = useRecipes(filters);

  return (
    <Layout>
      <PhoneHeader
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

      <div className="px-4 pt-3 space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {isLoading && (
          <div className="md:col-span-2">
            <SkeletonList count={4} />
          </div>
        )}
        {!isLoading && (recipes?.length ?? 0) === 0 && (
          <Card tone="clay" className="md:col-span-2">
            <div className="eyebrow">Empty shelf</div>
            <div
              className="font-display"
              style={{
                fontSize: 22,
                color: "var(--ink)",
                marginTop: 4,
              }}
            >
              Nothing saved yet
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--sumi)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Add a recipe by hand, or open a meal you love from your plan and
              tap “Save to recipe book.”
            </div>
            <Button
              variant="accent"
              className="mt-3"
              onClick={() => navigate("/recipes/new")}
            >
              <Icon name="plus" size={14} />
              Add a recipe
            </Button>
          </Card>
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
