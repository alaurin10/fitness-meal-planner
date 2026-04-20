import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./Icon";
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
  /** Optional action row rendered above the macros card (e.g. Back button). */
  topAction?: React.ReactNode;
  /** Optional action row rendered below the steps section (e.g. Save to book). */
  bottomActions?: React.ReactNode;
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
  topAction,
  bottomActions,
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
        onExit={() => setCooking(false)}
      />
    );
  }

  return (
    <>
      {topAction}
      <div className="px-4 pt-2 space-y-3">
        <Card tone="clay">
          <div
            className="font-display"
            style={{
              fontSize: 24,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            {meal.name}
          </div>
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
              <Button
                variant="ghost"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                aria-label="Fewer servings"
              >
                <Icon name="x" size={14} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setServings((s) => Math.min(20, s + 1))}
                aria-label="More servings"
              >
                <Icon name="plus" size={14} />
              </Button>
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
                      background: "var(--clay)",
                      color: "var(--ink)",
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

        {meal.steps.length > 0 && (
          <Button
            className="w-full"
            variant="accent"
            onClick={() => setCooking(true)}
          >
            <Icon name="flame" size={16} />
            Start cooking
          </Button>
        )}

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
      <div
        className="font-display"
        style={{ fontSize: 22, color: "var(--ink)", marginTop: 2 }}
      >
        {value}
        {suffix ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginLeft: 4,
              fontFamily: "var(--font-body)",
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

// ───────────────────────── Cooking mode ─────────────────────────

function CookingMode({
  meal,
  unitSystem,
  scale,
  onExit,
}: {
  meal: Meal;
  unitSystem: UnitSystem;
  scale: number;
  onExit: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = meal.steps[stepIdx];
  const total = meal.steps.length;

  if (!step) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      <div
        style={{
          padding: "16px 20px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="eyebrow">{meal.name}</div>
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit cooking mode"
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

      <div className="px-5">
        <div className="prog">
          <span style={{ width: `${((stepIdx + 1) / total) * 100}%` }} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 6,
            letterSpacing: "0.08em",
          }}
        >
          STEP {stepIdx + 1} OF {total}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px 28px",
          textAlign: "center",
          gap: 18,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 26,
            color: "var(--ink)",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            maxWidth: 360,
          }}
        >
          {step.text}
        </div>
        {step.durationMinutes ? (
          <StepTimer key={step.order} minutes={step.durationMinutes} />
        ) : null}
        <RelevantIngredients
          step={step.text}
          ingredients={meal.ingredients}
          unitSystem={unitSystem}
          scale={scale}
        />
      </div>

      <div
        style={{
          padding: "16px 20px 28px",
          display: "flex",
          gap: 10,
        }}
      >
        <Button
          variant="ghost"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          style={{ flex: 1 }}
        >
          <Icon
            name="chevron"
            size={14}
            style={{ transform: "rotate(180deg)" }}
          />
          Back
        </Button>
        {stepIdx < total - 1 ? (
          <Button
            variant="accent"
            onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
            style={{ flex: 1 }}
          >
            Next
            <Icon name="chevron" size={14} />
          </Button>
        ) : (
          <Button variant="accent" onClick={onExit} style={{ flex: 1 }}>
            <Icon name="check" size={16} />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

function StepTimer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const done = remaining === 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "16px 24px",
        background: "var(--paper)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--hair)",
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 36,
          color: done ? "var(--accent)" : "var(--ink)",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mm}:{ss}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="ghost"
          onClick={() => setRunning((r) => !r)}
          disabled={done}
        >
          {running
            ? "Pause"
            : remaining === minutes * 60
              ? "Start"
              : "Resume"}
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            setRunning(false);
            setRemaining(minutes * 60);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function RelevantIngredients({
  step,
  ingredients,
  unitSystem,
  scale,
}: {
  step: string;
  ingredients: Ingredient[];
  unitSystem: UnitSystem;
  scale: number;
}) {
  const stepLower = step.toLowerCase();
  const matches = ingredients.filter((i) =>
    stepLower.includes(i.name.toLowerCase()),
  );
  if (matches.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: 360,
      }}
    >
      {matches.map((m, i) => (
        <Chip key={i} variant="ghost">
          {formatQuantity(m.quantity, unitSystem, scale)} {m.name}
        </Chip>
      ))}
    </div>
  );
}
