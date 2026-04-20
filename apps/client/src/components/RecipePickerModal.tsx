import { useState } from "react";
import { useRecipes } from "../hooks/useRecipes";
import type { MealSlot, RecipeRecord } from "../lib/types";
import { formatMinutes } from "../lib/units";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  slot?: MealSlot;
  onPick: (recipe: RecipeRecord) => void;
  onClose: () => void;
}

export function RecipePickerModal({ open, slot, onPick, onClose }: Props) {
  const [search, setSearch] = useState("");
  const { data: recipes, isLoading } = useRecipes({
    search: search.trim() || undefined,
  });

  if (!open) return null;

  const filtered = recipes
    ? slot
      ? // Surface slot-matching recipes first, then the rest
        [
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
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          background: "var(--bg)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          display: "flex",
          flexDirection: "column",
          paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 12px)",
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
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            Pick a recipe
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
        <div style={{ padding: "0 18px 8px" }}>
          <input
            className="field-input"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: "4px 14px 8px",
            flex: 1,
          }}
        >
          {isLoading && (
            <div style={{ padding: 20, color: "var(--muted)" }}>Loading…</div>
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
              No saved recipes match. Save meals to your book first, or add one
              manually.
            </div>
          )}
          <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="tappable"
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--paper)",
                    border: "1px solid var(--hair)",
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 15,
                        color: "var(--ink)",
                        lineHeight: 1.2,
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--muted)",
                        marginTop: 4,
                      }}
                    >
                      {[
                        r.slotHint ? capitalize(r.slotHint) : null,
                        `${r.calories} kcal`,
                        `${r.proteinG}g protein`,
                        r.totalMinutes ? formatMinutes(r.totalMinutes) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {r.isFavorite && (
                    <Icon
                      name="heart"
                      size={14}
                      style={{ color: "var(--accent)" }}
                    />
                  )}
                  <Icon
                    name="chevron"
                    size={14}
                    style={{ color: "var(--muted)" }}
                  />
                </button>
              </li>
            ))}
          </ul>
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
