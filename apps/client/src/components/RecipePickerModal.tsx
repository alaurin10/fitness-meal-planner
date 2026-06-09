import { useState } from "react";
import { useRecipes } from "../hooks/useRecipes";
import { useIsDesktop } from "../hooks/useIsDesktop";
import type { MealSlot, RecipeRecord } from "../lib/types";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { RecipeCard } from "./RecipeCard";
import {
  CATEGORY_LABEL,
  RecipeFilterChips,
  isCategory,
  type FilterPreset,
} from "./RecipeFilterChips";
import { Skeleton } from "./Skeleton";

interface Props {
  open: boolean;
  slot?: MealSlot;
  onPick: (recipe: RecipeRecord) => void;
  onClose: () => void;
}

export function RecipePickerModal({ open, slot, onPick, onClose }: Props) {
  // Mount gate: PickerContent remounts on every open so search/filter state
  // resets and re-initializes from the current slot.
  if (!open) return null;
  return <PickerContent slot={slot} onPick={onPick} onClose={onClose} />;
}

function PickerContent({ slot, onPick, onClose }: Omit<Props, "open">) {
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>(slot ?? "all");
  const isDesktop = useIsDesktop();
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isDesktop ? "min(960px, calc(100vw - 48px))" : "100%",
          height: isDesktop ? "min(88vh, 900px)" : "calc(100dvh - 24px)",
          background: "var(--bg)",
          borderRadius: isDesktop ? 24 : "24px 24px 0 0",
          display: "flex",
          flexDirection: "column",
          paddingBottom: isDesktop ? 12 : "calc(env(safe-area-inset-bottom, 16px) + 12px)",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
              Pick a recipe
            </div>
            {slot && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Adding {CATEGORY_LABEL[slot]}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--sumi)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div style={{ padding: "0 18px" }}>
          <input
            className="field-input"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <RecipeFilterChips value={preset} onChange={setPreset} />

        <div
          style={{
            overflowY: "auto",
            padding: "8px 16px",
            flex: 1,
          }}
        >
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
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
            {!isLoading &&
              filtered.map((r) => (
                <RecipeCard key={r.id} recipe={r} onSelect={() => onPick(r)} />
              ))}
          </div>
        </div>

        <div style={{ padding: "0 18px" }}>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
