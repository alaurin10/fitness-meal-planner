import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useRecipes, type RecipeListFilters } from "../hooks/useRecipes";
import { formatMinutes } from "../lib/units";

type FilterPreset = "all" | "favorites" | "manual" | "ai";

const PRESETS: { id: FilterPreset; label: string }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "manual", label: "Manual" },
  { id: "ai", label: "From plans" },
];

export function RecipesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("all");

  const filters: RecipeListFilters = {
    search: search.trim() || undefined,
    favorite: preset === "favorites" ? true : undefined,
    source:
      preset === "manual"
        ? "MANUAL"
        : preset === "ai"
          ? "AI"
          : undefined,
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
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
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
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 space-y-2.5">
        {isLoading && <Card>Loading…</Card>}
        {!isLoading && (recipes?.length ?? 0) === 0 && (
          <Card tone="clay">
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
              <div
                className="placeholder-photo"
                style={{ width: 86, flexShrink: 0 }}
              >
                {abbr(r.name)}
              </div>
              <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
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

function abbr(s: string) {
  return s
    .split(/[·,]/)[0]!
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 14);
}
