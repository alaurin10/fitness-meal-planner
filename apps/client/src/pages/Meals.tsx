import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rotateDays, dayIdxFromDate, startOfWeek as sharedStartOfWeek, addWeeks, localDayKey as sharedLocalDayKey } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { RecipePickerModal } from "../components/RecipePickerModal";
import { WeekSelector } from "../components/WeekSelector";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  useAddSlot,
  useCreateEmptyPlan,
  useCurrentMealPlan,
  useDeleteSlot,
  useGenerateMealPlan,
  useRegenerateSlot,
  useReplaceSlot,
} from "../hooks/useMealPlan";
import { localDayKey, useMealCompletions } from "../hooks/useMealCompletions";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import { recipeToMeal } from "../lib/recipeAdapter";
import { fireCelebration } from "../lib/confetti";
import { formatMinutes, formatQuantity, type UnitSystem } from "../lib/units";
import type { Meal, MealDay, MealSlot, RecipeRecord } from "../lib/types";

type PendingPicker =
  | { kind: "replace"; day: MealDay["day"]; index: number; slot?: MealSlot }
  | { kind: "add"; day: MealDay["day"]; slot?: MealSlot };

export function MealsPage() {
  const weekStartDay = useWeekStartDay();
  const DAYS = rotateDays(weekStartDay);
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => sharedLocalDayKey(sharedStartOfWeek(now, weekStartDay)), [now, weekStartDay]);
  const nextWeekStart = useMemo(
    () => sharedLocalDayKey(addWeeks(sharedStartOfWeek(now, weekStartDay), 1)),
    [now, weekStartDay],
  );
  const [viewingWeekStart, setViewingWeekStart] = useState(thisWeekStart);

  const { data: plan, isLoading } = useCurrentMealPlan(viewingWeekStart);
  const generate = useGenerateMealPlan();
  const createEmpty = useCreateEmptyPlan();
  const regenSlot = useRegenerateSlot();
  const replaceSlot = useReplaceSlot();
  const addSlot = useAddSlot();
  const deleteSlot = useDeleteSlot();
  const { data: settings } = useSettings();
  const unitSystem: UnitSystem = settings?.unitSystem ?? "imperial";
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const todayIdx = dayIdxFromDate(now, weekStartDay);
  const [activeDay, setActiveDay] = useState<MealDay["day"]>(
    DAYS[todayIdx] ?? "Mon",
  );
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [picker, setPicker] = useState<PendingPicker | null>(null);
  const completions = useMealCompletions(plan?.id, localDayKey());
  const viewingToday = activeDay === DAYS[todayIdx];
  const prevDayCompleteRef = useRef(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout>
        <PhoneHeader
          title="Meals"
          subtitle="Generate a plan, or build one yourself meal by meal."
          right={
            <WeekSelector
              viewingWeekStart={viewingWeekStart}
              thisWeekStart={thisWeekStart}
              nextWeekStart={nextWeekStart}
              onChange={setViewingWeekStart}
            />
          }
        />
        <div className="px-4 pt-2 space-y-3">
          {generate.isPending ? (
            <GeneratingProgress kind="meal" estimatedSeconds={60} />
          ) : (
            <Card tone="gradient">
              <div
                className="font-display mt-1"
                style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                No active plan
              </div>
              <Button
                className="w-full mt-5"
                onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
              >
                <Icon name="sparkle" size={16} />
                Generate {viewingWeekStart === thisWeekStart ? "this week" : "next week"}
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => createEmpty.mutate({ targetWeekStart: viewingWeekStart })}
                disabled={createEmpty.isPending}
              >
                <Icon name="plus" size={16} />
                {createEmpty.isPending ? "Starting…" : "Start blank week"}
              </Button>
              {generate.isError && (
                <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 12 }}>
                  {(generate.error as Error).message}
                </p>
              )}
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  const dayEntry = plan.planJson.days.find((d) => d.day === activeDay);
  const meals = dayEntry?.meals ?? [];
  const dayKcal = meals.reduce((s, m) => s + m.calories, 0);
  const dayProtein = meals.reduce((s, m) => s + m.proteinG, 0);
  const nextSlotForDay = nextSuggestedSlot(meals);
  const anyMutation =
    regenSlot.isPending ||
    replaceSlot.isPending ||
    addSlot.isPending ||
    deleteSlot.isPending;

  function handleRegenerate(index: number) {
    setOpenMenu(null);
    regenSlot.mutate({ day: activeDay, index, weekStart: viewingWeekStart });
  }

  function handleDelete(index: number) {
    setOpenMenu(null);
    if (!window.confirm("Remove this meal from the day?")) return;
    deleteSlot.mutate({ day: activeDay, index, weekStart: viewingWeekStart });
  }

  function handleSwap(index: number, slotHint?: MealSlot) {
    setOpenMenu(null);
    setPicker({ kind: "replace", day: activeDay, index, slot: slotHint });
  }

  function handleAdd(slotHint?: MealSlot) {
    setPicker({ kind: "add", day: activeDay, slot: slotHint });
  }

  function handlePick(recipe: RecipeRecord) {
    if (!picker) return;
    const meal: Meal = recipeToMeal(recipe);
    if (picker.slot) meal.slot = picker.slot;
    if (picker.kind === "replace") {
      replaceSlot.mutate({
        day: picker.day,
        index: picker.index,
        meal,
        weekStart: viewingWeekStart,
      });
    } else {
      addSlot.mutate({ day: picker.day, meal, weekStart: viewingWeekStart });
    }
    setPicker(null);
  }

  return (
    <Layout>
      <PhoneHeader
        title="Meals"
        subtitle={plan.planJson.summary}
        right={
          <WeekSelector
            viewingWeekStart={viewingWeekStart}
            thisWeekStart={thisWeekStart}
            nextWeekStart={nextWeekStart}
            onChange={setViewingWeekStart}
          />
        }
      />

      <div style={isDesktop ? { display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, padding: "0 16px" } : undefined}>
      <div style={isDesktop ? { paddingTop: 4 } : { padding: "4px 16px 8px", overflowX: "auto" as const }}>
        <div style={{ display: "flex", flexDirection: isDesktop ? "column" as const : "row" as const, gap: 6 }}>
          {DAYS.map((d) => {
            const day = plan.planJson.days.find((pd) => pd.day === d);
            const count = day?.meals.length ?? 0;
            const isActive = activeDay === d;
            const isToday = d === DAYS[todayIdx];
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className="tappable"
                style={{
                  flex: isDesktop ? "none" : 1,
                  minWidth: isDesktop ? undefined : 56,
                  border: "none",
                  background: isActive ? "var(--ink)" : "var(--paper)",
                  color: isActive ? "var(--paper)" : "var(--ink)",
                  padding: "10px 8px",
                  borderRadius: "calc(var(--radius) * 0.7)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    opacity: 0.7,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {d}
                </span>
                <span className="font-display" style={{ fontSize: 16 }}>
                  {count === 0 ? "·" : count}
                </span>
                {isToday && !isActive && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 6,
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: "var(--accent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
      <div className="px-4 pt-2">
        <Card tone="clay">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">{longDay(activeDay)}</div>
              <div
                className="font-display mt-1"
                style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {meals.length ? `${meals.length} meals` : "Nothing planned"}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--sumi)",
                  marginTop: 6,
                  display: "flex",
                  gap: 10,
                }}
              >
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>{dayKcal}</b> kcal
                </span>
                <span>·</span>
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>{dayProtein}</b>g protein
                </span>
              </div>
            </div>
            <Icon name="leaf" size={36} style={{ color: "var(--moss)", flexShrink: 0 }} />
          </div>
        </Card>
      </div>

      <div className="px-4 pt-3 space-y-2.5">
        {meals.map((m, i) => {
          const total =
            m.totalMinutes ??
            ((m.prepMinutes ?? 0) + (m.cookMinutes ?? 0) || undefined);
          const isRegenTarget =
            regenSlot.isPending &&
            regenSlot.variables?.day === activeDay &&
            regenSlot.variables?.index === i;
          const mealComplete = viewingToday && completions.isComplete(i);
          return (
            <div key={i} style={{ position: "relative" }}>
              <Card
                flush
                className="flex tappable"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/meals/${viewingWeekStart}/${activeDay}/${i}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/meals/${viewingWeekStart}/${activeDay}/${i}`);
                  }
                }}
                style={{
                  ...(isRegenTarget ? { opacity: 0.55 } : {}),
                  ...(mealComplete ? {
                    opacity: 0.6,
                    borderLeft: "3px solid var(--accent)",
                  } : {}),
                  transition: "opacity 300ms ease",
                }}
              >
                {/* Completion checkmark badge */}
                {mealComplete && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      color: "var(--paper)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 5,
                      animation: "checkPop 260ms ease",
                    }}
                  >
                    <Icon name="check" size={14} stroke={2.5} />
                  </div>
                )}
                <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
                  <div className="eyebrow">
                    {mealSlotLabel(m, i)} · {m.calories} kcal
                    {m.isLeftover && (
                      <span style={{ color: "var(--accent)", marginLeft: 6 }}>
                        · Leftovers
                      </span>
                    )}
                  </div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: 17,
                      color: "var(--ink)",
                      marginTop: 4,
                      lineHeight: 1.2,
                    }}
                  >
                    {isRegenTarget ? "Regenerating…" : m.name}
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <Chip variant="moss">{m.proteinG}g protein</Chip>
                    {m.isLeftover && (
                      <Chip variant="ghost">
                        <Icon name="swap" size={11} /> Leftovers
                      </Chip>
                    )}
                    {total ? (
                      <Chip variant="ghost">
                        <Icon name="timer" size={11} /> {formatMinutes(total)}
                      </Chip>
                    ) : null}
                    {m.steps.length > 0 ? (
                      <Chip variant="ghost">
                        {m.steps.length} step{m.steps.length === 1 ? "" : "s"}
                      </Chip>
                    ) : null}
                  </div>
                  {m.ingredients.length > 0 && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--muted)",
                        marginTop: 8,
                        lineHeight: 1.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {m.ingredients
                        .map(
                          (ing) =>
                            `${formatQuantity(ing.quantity, unitSystem)} ${ing.name}`.trim(),
                        )
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingRight: 6,
                    color: "var(--muted)",
                  }}
                >
                  <Icon name="chevron" size={18} />
                </div>
              </Card>

              <SlotMenu
                open={openMenu === i}
                onToggle={() => setOpenMenu(openMenu === i ? null : i)}
                onRegenerate={() => handleRegenerate(i)}
                onSwap={() => handleSwap(i, m.slot ?? undefined)}
                onDelete={() => handleDelete(i)}
                disabled={anyMutation}
              />
              {viewingToday && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    completions.toggle(i, meals.length);
                    // Fire confetti when completing the last meal
                    if (!mealComplete && completions.completed.size === meals.length - 1) {
                      setTimeout(() => fireCelebration(), 200);
                    }
                  }}
                  className="tappable"
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: mealComplete ? "none" : "1.5px solid var(--hair)",
                    background: mealComplete ? "var(--accent)" : "var(--paper)",
                    color: mealComplete ? "var(--paper)" : "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 5,
                    transition: "all 200ms ease",
                  }}
                  aria-label={mealComplete ? "Mark incomplete" : "Mark complete"}
                >
                  <Icon name="check" size={14} stroke={2} />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => handleAdd(nextSlotForDay)}
          disabled={anyMutation}
          className="tappable"
          style={{
            width: "100%",
            padding: "14px",
            background: "transparent",
            border: "1.5px dashed var(--hair)",
            borderRadius: "var(--radius)",
            color: "var(--sumi)",
            fontFamily: "var(--font-body)",
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Icon name="plus" size={14} />
          Add a meal{nextSlotForDay ? ` (${capitalize(nextSlotForDay)})` : ""}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {generate.isPending && (
          <GeneratingProgress kind="meal" estimatedSeconds={60} />
        )}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
          disabled={generate.isPending}
        >
          <Icon name="sparkle" size={16} />
          {generate.isPending
            ? "Regenerating…"
            : viewingWeekStart === thisWeekStart
              ? "Regenerate this week"
              : "Regenerate next week"}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            if (
              window.confirm(
                "Replace the current plan with a blank week? Auto grocery items will be cleared.",
              )
            ) {
              createEmpty.mutate({ targetWeekStart: viewingWeekStart });
            }
          }}
          disabled={createEmpty.isPending}
        >
          <Icon name="plus" size={16} />
          {createEmpty.isPending ? "Starting…" : "Start blank week"}
        </Button>
        {(generate.isError || regenSlot.isError || replaceSlot.isError || deleteSlot.isError) && (
          <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 6 }}>
            {(generate.error ||
              regenSlot.error ||
              replaceSlot.error ||
              deleteSlot.error) instanceof Error
              ? (generate.error || regenSlot.error || replaceSlot.error || deleteSlot.error)!
                  .message
              : "Something went wrong. Try again."}
          </p>
        )}
      </div>
      </div>
      </div>

      <RecipePickerModal
        open={picker !== null}
        slot={picker?.slot}
        onPick={handlePick}
        onClose={() => setPicker(null)}
      />
    </Layout>
  );
}

interface SlotMenuProps {
  open: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  onSwap: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function SlotMenu({
  open,
  onToggle,
  onRegenerate,
  onSwap,
  onDelete,
  disabled,
}: SlotMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onToggle]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        aria-label="Meal options"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        style={{
          width: 30,
          height: 30,
          borderRadius: 99,
          border: "1px solid var(--hair)",
          background: "var(--paper)",
          color: "var(--sumi)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon name="ellipsis" size={16} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            minWidth: 180,
            background: "var(--paper)",
            border: "1px solid var(--hair)",
            borderRadius: 12,
            boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <MenuItem
            icon="sparkle"
            label="Regenerate"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
          />
          <MenuItem
            icon="swap"
            label="Swap from book"
            onClick={(e) => {
              e.stopPropagation();
              onSwap();
            }}
          />
          <MenuItem
            icon="x"
            label="Remove"
            tone="rose"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: "sparkle" | "swap" | "x";
  label: string;
  tone?: "rose";
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        textAlign: "left",
        padding: "9px 10px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13.5,
        color: tone === "rose" ? "var(--rose)" : "var(--ink)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

function nextSuggestedSlot(meals: Meal[]): MealSlot | undefined {
  const order: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
  for (const slot of order) {
    if (!meals.some((m) => m.slot === slot)) return slot;
  }
  return "snack";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function longDay(d: MealDay["day"]) {
  return {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  }[d];
}

function mealSlotLabel(meal: Meal, i: number) {
  if (meal.slot) {
    const map: Record<string, string> = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snack: "Snack",
    };
    return map[meal.slot] ?? "Meal";
  }
  return ["Breakfast", "Lunch", "Dinner", "Snack", "Snack", "Snack"][i] ?? "Meal";
}
