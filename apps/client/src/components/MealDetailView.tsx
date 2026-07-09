import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { CircleButton } from "./CircleButton";
import { CookingMode } from "./CookingMode";
import { Icon } from "./Icon";
import { Illustration, mealIllustration } from "./Illustration";
import { Chip } from "./Primitives";
import { useSettings } from "../hooks/useSettings";
import {
  formatMinutes,
  formatQuantity,
  type UnitSystem,
} from "../lib/units";
import type { Ingredient, Meal } from "../lib/types";

interface MealDetailViewProps {
  meal: Meal;
  slotLabel?: string;
  /** Identifies this meal across sessions so a cooking session can resume. */
  sessionKey?: string;
  /** Optional action row rendered above the macros card (e.g. Back button). */
  topAction?: React.ReactNode;
  /** Optional action row rendered below the steps section (e.g. Save to book). */
  bottomActions?: React.ReactNode;
  /** When true, render the "Marked complete · Undo" state. */
  isComplete?: boolean;
  /** When provided, render a Mark complete / Undo button. */
  onToggleComplete?: () => void;
}

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealDetailView({
  meal,
  slotLabel,
  sessionKey,
  topAction,
  bottomActions,
  isComplete,
  onToggleComplete,
}: MealDetailViewProps) {
  const { data: settings } = useSettings();
  const unitSystem: UnitSystem = settings?.unitSystem ?? "imperial";

  const [servings, setServings] = useState<number>(meal.servings);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [cooking, setCooking] = useState(false);

  // Reset state when meal identity changes
  useEffect(() => {
    setServings(meal.servings);
    setChecked({});
    setCooking(false);
  }, [meal]);

  const scale = useMemo(
    () => servings / Math.max(1, meal.servings),
    [servings, meal.servings],
  );

  const total =
    meal.totalMinutes ??
    ((meal.prepMinutes ?? 0) + (meal.cookMinutes ?? 0) || undefined);
  const resolvedSlot =
    slotLabel ?? (meal.slot ? SLOT_LABEL[meal.slot] : undefined);

  if (cooking) {
    return (
      <CookingMode
        meal={meal}
        unitSystem={unitSystem}
        scale={scale}
        sessionKey={sessionKey ?? meal.name}
        onExit={() => setCooking(false)}
        onComplete={
          // Auto-mark the meal complete when guided cooking finishes,
          // unless it's already marked complete.
          onToggleComplete && !isComplete ? onToggleComplete : undefined
        }
      />
    );
  }

  return (
    <>
      {topAction}
      <div className="px-4 pt-2 space-y-3">
        <Card tone="hero" className="texture-grain">
          {/* The "photo" moment: slot art on an accent wash banner */}
          <div
            aria-hidden
            style={{
              display: "flex",
              justifyContent: "center",
              background: "var(--wash-accent)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 0 4px",
              marginBottom: 14,
            }}
          >
            <Illustration name={mealIllustration(meal.slot)} size={176} />
          </div>
          <div
            className="display-hero"
            style={{ fontSize: "clamp(28px, 7.5vw, 36px)", lineHeight: 1.05 }}
          >
            {meal.name}
          </div>
          {meal.isLeftover && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--accent)",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="swap" size={12} />
              Leftovers — no additional groceries needed
            </div>
          )}
          {(resolvedSlot || total) && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--sumi)",
                marginTop: 4,
              }}
            >
              {[resolvedSlot, total ? formatMinutes(total) : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              marginTop: 14,
            }}
          >
            <Stat
              label="Calories"
              value={`${Math.round(meal.calories * scale)}`}
              suffix="kcal"
            />
            <Stat
              label="Protein"
              value={`${Math.round(meal.proteinG * scale)}`}
              suffix="g"
            />
            {meal.carbsG !== undefined && meal.carbsG !== null && (
              <Stat
                label="Carbs"
                value={`${Math.round(meal.carbsG * scale)}`}
                suffix="g"
              />
            )}
            {meal.fatG !== undefined && meal.fatG !== null && (
              <Stat
                label="Fat"
                value={`${Math.round(meal.fatG * scale)}`}
                suffix="g"
              />
            )}
          </div>
          {(meal.prepMinutes || meal.cookMinutes || meal.tags?.length) && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {meal.prepMinutes ? (
                <Chip variant="ghost">
                  <Icon name="timer" size={12} /> Prep{" "}
                  {formatMinutes(meal.prepMinutes)}
                </Chip>
              ) : null}
              {meal.cookMinutes ? (
                <Chip variant="ghost">
                  <Icon name="flame" size={12} /> Cook{" "}
                  {formatMinutes(meal.cookMinutes)}
                </Chip>
              ) : null}
              {meal.tags?.map((t) => (
                <Chip key={t} variant="moss">
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div className="eyebrow">Servings</div>
              <div
                className="font-display"
                style={{
                  fontSize: 22,
                  color: "var(--ink)",
                  marginTop: 2,
                }}
              >
                {servings}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <CircleButton
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                aria-label="Fewer servings"
                disabled={servings <= 1}
              >
                <Icon name="minus" size={14} />
              </CircleButton>
              <CircleButton
                onClick={() => setServings((s) => Math.min(20, s + 1))}
                aria-label="More servings"
                disabled={servings >= 20}
              >
                <Icon name="plus" size={14} />
              </CircleButton>
            </div>
          </div>
          {scale !== 1 && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                marginTop: 8,
              }}
            >
              Ingredient amounts and macros scaled ×
              {scale.toFixed(2).replace(/\.?0+$/, "")}.
            </div>
          )}
        </Card>

        <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
        <Card>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Ingredients
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {meal.ingredients.map((ing, i) => (
              <IngredientRow
                key={i}
                ing={ing}
                checked={!!checked[i]}
                onToggle={() =>
                  setChecked((c) => ({ ...c, [i]: !c[i] }))
                }
                unitSystem={unitSystem}
                scale={scale}
              />
            ))}
          </ul>
        </Card>

        <div className="space-y-3">
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div className="eyebrow">Steps</div>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
              }}
            >
              {meal.steps.length} step{meal.steps.length === 1 ? "" : "s"}
            </span>
          </div>
          {meal.steps.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--muted)",
                lineHeight: 1.5,
              }}
            >
              No instructions saved for this meal yet. Regenerate the plan to
              get full cooking steps.
            </div>
          ) : (
            <ol
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                paddingLeft: 0,
                listStyle: "none",
              }}
            >
              {meal.steps.map((s) => (
                <li
                  key={s.order}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    className="font-display"
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    {s.order}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: "var(--ink)",
                        lineHeight: 1.5,
                      }}
                    >
                      {s.text}
                    </div>
                    {s.durationMinutes ? (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11.5,
                          color: "var(--muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon name="timer" size={12} />{" "}
                        {formatMinutes(s.durationMinutes)}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {(meal.steps.length > 0 || onToggleComplete) && (
          <div
            className="glass sticky bottom-[calc(env(safe-area-inset-bottom,8px)+78px)] md:bottom-4"
            style={{
              borderRadius: "var(--radius-lg)",
              padding: 10,
              display: "flex",
              gap: 8,
              zIndex: 15,
            }}
          >
            {meal.steps.length > 0 && (
              <Button
                size="lg"
                variant={onToggleComplete ? "ghost" : "accent"}
                onClick={() => setCooking(true)}
                style={{ flex: 1 }}
              >
                <Icon name="flame" size={16} />
                Cook
              </Button>
            )}
            {onToggleComplete && (
              <Button
                size="lg"
                variant={isComplete ? "ghost" : "accent"}
                onClick={onToggleComplete}
                style={{
                  flex: 1.4,
                  transition: "all 300ms ease",
                  ...(isComplete ? {
                    background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                    borderColor: "var(--accent)",
                  } : {}),
                }}
              >
                <span style={{ display: "inline-flex", animation: isComplete ? "checkPop 260ms ease" : undefined }}>
                  <Icon name="check" size={16} />
                </span>
                {isComplete ? "Eaten ✓" : "Mark eaten"}
              </Button>
            )}
          </div>
        )}
        </div>
        </div>

        {meal.notes && (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Notes
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: "var(--sumi)",
                lineHeight: 1.55,
              }}
            >
              {meal.notes}
            </div>
          </Card>
        )}

        {bottomActions}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="display-stat" style={{ fontSize: 28, marginTop: 2 }}>
        {value}
        {suffix ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginLeft: 4,
              fontFamily: "var(--font-body)",
              fontWeight: 400,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function IngredientRow({
  ing,
  checked,
  onToggle,
  unitSystem,
  scale,
}: {
  ing: Ingredient;
  checked: boolean;
  onToggle: () => void;
  unitSystem: UnitSystem;
  scale: number;
}) {
  const display = formatQuantity(ing.quantity, unitSystem, scale);
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="tappable"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "8px 0",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `1.5px solid ${
              checked ? "var(--accent)" : "var(--hair)"
            }`,
            background: checked ? "var(--accent)" : "transparent",
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {checked && <Icon name="check" size={12} stroke={2.5} />}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            color: checked ? "var(--muted)" : "var(--ink)",
            textDecoration: checked ? "line-through" : "none",
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontWeight: 500 }}>{ing.name}</span>
          {ing.note ? (
            <span style={{ color: "var(--muted)" }}> · {ing.note}</span>
          ) : null}
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: "var(--sumi)",
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
          }}
        >
          {display}
        </span>
      </button>
    </li>
  );
}
