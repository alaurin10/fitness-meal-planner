import { Icon } from "./Icon";
import { RECIPE_CATEGORIES, type RecipeCategory } from "../lib/types";

export type FilterPreset = "all" | "favorites" | RecipeCategory;

export const CATEGORY_LABEL: Record<RecipeCategory, string> = {
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

export function isCategory(preset: FilterPreset): preset is RecipeCategory {
  return preset !== "all" && preset !== "favorites";
}

export function RecipeFilterChips({
  value,
  onChange,
}: {
  value: FilterPreset;
  onChange: (preset: FilterPreset) => void;
}) {
  return (
    <div
      style={{
        padding: "10px 16px 4px",
        display: "flex",
        gap: 6,
        overflowX: "auto",
      }}
    >
      {CHIPS.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
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
  );
}
