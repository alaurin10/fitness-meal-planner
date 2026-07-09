import { useState } from "react";
import { useRecipes } from "../hooks/useRecipes";
import type { MealSlot, RecipeRecord } from "../lib/types";
import { RecipeCard } from "./RecipeCard";
import {
  CATEGORY_LABEL,
  RecipeFilterChips,
  isCategory,
  type FilterPreset,
} from "./RecipeFilterChips";
import { Skeleton } from "./Skeleton";

/**
 * Search + filter + result grid, shared by RecipePickerModal (single-pick
 * modal) and RecipeTray (the week-canvas side panel / sheet). No Sheet
 * chrome of its own — callers own the surrounding layout.
 */
export function RecipeBrowser({
  slot,
  onPick,
  renderCard,
  gridClassName = "space-y-2.5",
}: {
  slot?: MealSlot;
  onPick: (recipe: RecipeRecord) => void;
  /** Override how each result renders (e.g. to make it draggable). */
  renderCard?: (recipe: RecipeRecord) => React.ReactNode;
  /** Classes for the results container — pass responsive grid columns here. */
  gridClassName?: string;
}) {
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>(slot ?? "all");
  const { data: recipes, isLoading } = useRecipes({
    search: search.trim() || undefined,
    favorite: preset === "favorites" ? true : undefined,
    category: isCategory(preset) ? preset : undefined,
  });

  // On "All", surface slot-matching recipes first; category chips already
  // filter server-side, so render those results as-is.
  const filtered = recipes
    ? slot && preset === "all"
      ? [
          ...recipes.filter((r) => r.slotHint === slot),
          ...recipes.filter((r) => r.slotHint !== slot),
        ]
      : recipes
    : [];

  return (
    <>
      <div style={{ padding: "0 2px" }}>
        <input
          className="field-input"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <RecipeFilterChips value={preset} onChange={setPreset} />

      <div style={{ overflowY: "auto", padding: "8px 2px", flex: 1 }}>
        {isLoading && (
          <div style={{ padding: "4px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={84} radius={16} />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              padding: "24px 12px",
              color: "var(--muted)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {isCategory(preset)
              ? `No ${CATEGORY_LABEL[preset].toLowerCase()} recipes match. Try “All,” or save more recipes to your book.`
              : preset === "favorites"
                ? "No favorite recipes match. Try “All,” or heart some recipes first."
                : "No saved recipes match. Save meals to your book first, or add one manually."}
          </div>
        )}
        <div className={gridClassName}>
          {!isLoading &&
            filtered.map((r) =>
              renderCard ? (
                <div key={r.id}>{renderCard(r)}</div>
              ) : (
                <RecipeCard key={r.id} recipe={r} onSelect={() => onPick(r)} />
              ),
            )}
        </div>
      </div>
    </>
  );
}
