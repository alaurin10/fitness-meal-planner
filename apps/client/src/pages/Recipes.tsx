import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useRecipes, type RecipeListFilters } from "../hooks/useRecipes";
import { RECIPE_CATEGORIES, type RecipeCategory } from "../lib/types";
import { formatMinutes } from "../lib/units";

type FilterPreset = "all" | "favorites" | RecipeCategory;

const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
  baking: "Baking",
  drinks: "Drinks",
  sides: "Sides",
  other: "Other",
};

interface ChipDef {
  id: FilterPreset;
  label: string;
  icon?: "heart";
}

const CHIPS: ChipDef[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites", icon: "heart" },
  ...RECIPE_CATEGORIES.map<ChipDef>((c) => ({
    id: c,
    label: CATEGORY_LABEL[c],
  })),
];

function isCategory(preset: FilterPreset): preset is RecipeCategory {
  return preset !== "all" && preset !== "favorites";
}

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

      <div
        style={{
          padding: "10px 16px 4px",
          display: "flex",
          gap: 6,
          overflowX: "auto",
        }}
      >
        {CHIPS.map((c) => {
          const active = preset === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPreset(c.id)}
              className="tappable"
              style={{
                border: "none",
                background: active ? "var(--ink)" : "var(--paper)",
                color: active ? "var(--paper)" : "var(--ink)",
                padding: "8px 14px",
                borderRadius: 999,
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                fontWeight: 500,
                whiteSpace: "nowrap",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.icon === "heart" && <Icon name="heart" size={12} />}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {isLoading && <Card>Loading…</Card>}
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

        {recipes?.map((r) => {
          const total = r.totalMinutes ?? null;
          return (
            <Card
              key={r.id}
              flush
              className="flex tappable"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/recipes/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/recipes/${r.id}`);
                }
              }}
            >
              <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
                <div className="eyebrow">
                  {r.source === "AI" ? "From plan" : "Manual"} ·{" "}
                  {r.calories} kcal
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 16,
                    color: "var(--ink)",
                    marginTop: 4,
                    lineHeight: 1.2,
                  }}
                >
                  {r.name}
                </div>
                <div
                  className="flex"
                  style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}
                >
                  <Chip variant="moss">{r.proteinG}g protein</Chip>
                  {total ? (
                    <Chip variant="ghost">
                      <Icon name="timer" size={11} /> {formatMinutes(total)}
                    </Chip>
                  ) : null}
                  {r.tags.slice(0, 2).map((t) => (
                    <Chip key={t} variant="ghost">
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingRight: 12,
                  color: r.isFavorite ? "var(--accent)" : "var(--muted)",
                }}
                aria-label={r.isFavorite ? "Favorite" : undefined}
              >
                {r.isFavorite ? (
                  <Icon name="heart" size={16} />
                ) : (
                  <Icon name="chevron" size={16} />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
