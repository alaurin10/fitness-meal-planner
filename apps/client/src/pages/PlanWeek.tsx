import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  rotateDays,
  startOfWeek as sharedStartOfWeek,
  localDayKey as sharedLocalDayKey,
  computePlanWindow,
  parseLocalDate,
  dayLabelFromDate,
} from "@platform/shared";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PageHero } from "../components/Primitives";
import { RecipePickerModal } from "../components/RecipePickerModal";
import { CellActionSheet } from "../components/planWeek/CellActionSheet";
import { RecipeTray } from "../components/planWeek/RecipeTray";
import { WeekGrid, type WeekGridCellView } from "../components/planWeek/WeekGrid";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useCurrentMealPlan, usePlanWeek, type PlanWeekCellInput } from "../hooks/useMealPlan";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import type { Meal, MealDay, MealSlot, RecipeRecord } from "../lib/types";

const CORE_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

type CellAssign =
  | { mode: "generate" }
  | { mode: "recipe"; recipe: RecipeRecord }
  | { mode: "keep"; meal: Meal }
  | { mode: "skip" };

type CellKey = `${MealDay["day"]}:${MealSlot}`;
const key = (day: MealDay["day"], slot: MealSlot): CellKey => `${day}:${slot}`;

/**
 * Week-building canvas: lay out AI-generated slots, recipe-book picks, kept
 * meals, and skips across the whole week, then build it in one request.
 * Tap-first everywhere; desktop also gets a drag-from-tray shortcut.
 */
export function PlanWeekPage() {
  const navigate = useNavigate();
  const { weekStart: weekStartParam } = useParams<{ weekStart?: string }>();
  const weekStartDay = useWeekStartDay();
  const { data: settings } = useSettings();
  const isDesktop = useIsDesktop();
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(
    () => sharedLocalDayKey(sharedStartOfWeek(now, weekStartDay)),
    [now, weekStartDay],
  );
  const targetWeekStart = weekStartParam ?? thisWeekStart;
  const targetDate = useMemo(() => parseLocalDate(targetWeekStart), [targetWeekStart]);
  const DAYS = useMemo(() => rotateDays(weekStartDay), [weekStartDay]);
  const { daysToInclude, isCurrentWeek } = useMemo(
    () => computePlanWindow(targetDate, now, weekStartDay),
    [targetDate, now, weekStartDay],
  );
  const disabledDays = useMemo(
    () => new Set(DAYS.filter((d) => !daysToInclude.includes(d))),
    [DAYS, daysToInclude],
  );
  const todayDay = isCurrentWeek ? dayLabelFromDate(now) : undefined;

  const { data: existingPlan, isLoading: planLoading } = useCurrentMealPlan(targetWeekStart);
  const planWeek = usePlanWeek();

  const template = settings?.mealSchedule ?? {};
  const [cells, setCells] = useState<Partial<Record<CellKey, CellAssign>> | null>(null);
  const [pendingCell, setPendingCell] = useState<{ day: MealDay["day"]; slot: MealSlot } | null>(null);
  const [pickerFor, setPickerFor] = useState<{ day: MealDay["day"]; slot: MealSlot } | null>(null);

  // Initialize once the plan finishes loading: existing meals become "keep"
  // cells, template-skipped slots default to skip, everything else generates.
  const initialized = cells !== null;
  if (!initialized && !planLoading) {
    const next: Partial<Record<CellKey, CellAssign>> = {};
    for (const day of DAYS) {
      const existingDay = existingPlan?.planJson.days.find((d) => d.day === day);
      for (const slot of ALL_SLOTS) {
        const meal = existingDay?.meals.find((m) => m.slot === slot);
        if (meal) {
          next[key(day, slot)] = { mode: "keep", meal };
        } else if (slot !== "snack" && template[day]?.includes(slot)) {
          next[key(day, slot)] = { mode: "skip" };
        } else if (slot === "snack") {
          next[key(day, slot)] = { mode: "skip" };
        } else {
          next[key(day, slot)] = { mode: "generate" };
        }
      }
    }
    setCells(next);
  }

  function getCell(day: MealDay["day"], slot: MealSlot): WeekGridCellView {
    const assign = cells?.[key(day, slot)] ?? { mode: "generate" };
    switch (assign.mode) {
      case "recipe":
        return { label: assign.recipe.name, tone: "recipe", icon: "fork" };
      case "keep":
        return { label: assign.meal.name, tone: "keep", icon: "check" };
      case "skip":
        return { label: "Skipped", tone: "skip", icon: "x" };
      default:
        return { label: "Generate", tone: "generate", icon: "sparkle" };
    }
  }

  function setCell(day: MealDay["day"], slot: MealSlot, assign: CellAssign) {
    setCells((prev) => ({ ...(prev ?? {}), [key(day, slot)]: assign }));
  }

  function handleCellTap(day: MealDay["day"], slot: MealSlot) {
    if (disabledDays.has(day)) return;
    setPendingCell({ day, slot });
  }

  const pendingAssign = pendingCell ? (cells?.[key(pendingCell.day, pendingCell.slot)] ?? { mode: "generate" }) : null;

  /** The meal originally in the saved plan at (day, slot), if any — lets
   * "Keep current meal" restore it after the cell was switched away. */
  function originalMealFor(day: MealDay["day"], slot: MealSlot): Meal | undefined {
    return existingPlan?.planJson.days.find((d) => d.day === day)?.meals.find((m) => m.slot === slot);
  }

  // Desktop drag-and-drop: dropping a tray recipe on a grid cell assigns it
  // the same way tapping "Pick from book" would.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [draggingRecipe, setDraggingRecipe] = useState<RecipeRecord | null>(null);

  function onDragEnd(e: DragEndEvent) {
    setDraggingRecipe(null);
    const recipe = e.active.data.current?.recipe as RecipeRecord | undefined;
    const overId = e.over?.id;
    if (!recipe || typeof overId !== "string") return;
    const [day, slot] = overId.split(":") as [MealDay["day"], MealSlot];
    if (disabledDays.has(day)) return;
    setCell(day, slot, { mode: "recipe", recipe });
  }

  const counts = useMemo(() => {
    const values = Object.values(cells ?? {}) as CellAssign[];
    return {
      generate: values.filter((c) => c.mode === "generate").length,
      book: values.filter((c) => c.mode === "recipe" || c.mode === "keep").length,
      skip: values.filter((c) => c.mode === "skip").length,
    };
  }, [cells]);

  function buildCellPayload(): PlanWeekCellInput[] {
    const payload: PlanWeekCellInput[] = [];
    for (const day of daysToInclude) {
      for (const slot of ALL_SLOTS) {
        const assign = cells?.[key(day, slot)] ?? { mode: "generate" };
        if (assign.mode === "recipe") {
          payload.push({ day, slot, mode: "recipe", recipeId: assign.recipe.id });
        } else if (assign.mode === "keep") {
          payload.push({ day, slot, mode: "keep" });
        } else if (assign.mode === "skip") {
          payload.push({ day, slot, mode: "skip" });
        } else {
          payload.push({ day, slot, mode: "generate" });
        }
      }
    }
    return payload;
  }

  function handleBuild() {
    planWeek.mutate(
      { targetWeekStart, cells: buildCellPayload() },
      { onSuccess: () => navigate("/meals") },
    );
  }

  const grid = (
    <WeekGrid
      days={DAYS}
      slots={CORE_SLOTS.concat(
        // Only show the snack row once something's actually assigned there,
        // to keep the grid compact by default.
        Object.entries(cells ?? {}).some(
          ([k, v]) => k.endsWith(":snack") && v && v.mode !== "skip",
        )
          ? ["snack"]
          : [],
      )}
      todayDay={todayDay}
      weekStartDate={targetDate}
      disabledDays={disabledDays}
      getCell={getCell}
      onCellTap={handleCellTap}
      dndEnabled={isDesktop}
    />
  );

  return (
    <Layout>
      <PageHero
        title="Plan the week"
        subtitle="Tap a slot to generate, pick from your book, or skip it. Drag on desktop works too."
        right={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <Icon name="x" size={16} />
          </Button>
        }
      />

      {planWeek.isPending ? (
        <div className="px-4 pt-2">
          <GeneratingProgress kind="meal" estimatedSeconds={60} />
        </div>
      ) : !initialized ? (
        <div className="px-4 pt-2 text-caption">Loading your current plan…</div>
      ) : (
        <div className="px-4 pt-2 pb-28">
          {isDesktop ? (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setDraggingRecipe((e.active.data.current?.recipe as RecipeRecord) ?? null)}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDraggingRecipe(null)}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
                <div>{grid}</div>
                <div style={{ position: "sticky", top: 16, height: "calc(100vh - 140px)" }}>
                  <RecipeTray
                    slot={pendingCell?.slot}
                    onPick={(recipe) => {
                      if (pendingCell) setCell(pendingCell.day, pendingCell.slot, { mode: "recipe", recipe });
                    }}
                  />
                </div>
              </div>
              <DragOverlay>
                {draggingRecipe && (
                  <div className="chip" style={{ boxShadow: "var(--shadow-md)" }}>
                    <Icon name="fork" size={12} />
                    {draggingRecipe.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            grid
          )}

          {planWeek.isError && (
            <div style={{ marginTop: 12 }}>
              <ErrorState compact error={planWeek.error} onRetry={handleBuild} retrying={planWeek.isPending} />
            </div>
          )}
        </div>
      )}

      {/* Sticky summary + build bar */}
      <div
        className="glass"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(env(safe-area-inset-bottom, 8px) + 76px)",
          margin: "0 16px",
          borderRadius: "var(--radius-lg)",
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 15,
        }}
      >
        <div className="text-caption" style={{ flex: 1 }}>
          {counts.generate} AI · {counts.book} from book · {counts.skip} skipped
        </div>
        <Button variant="accent" onClick={handleBuild} disabled={planWeek.isPending || !initialized}>
          {planWeek.isPending ? "Building…" : "Build week"}
          <Icon name="chevron" size={16} />
        </Button>
      </div>

      <CellActionSheet
        open={pendingCell !== null}
        day={pendingCell?.day ?? null}
        slot={pendingCell?.slot ?? null}
        hasExistingMeal={pendingCell ? originalMealFor(pendingCell.day, pendingCell.slot) != null : false}
        onGenerate={() => {
          if (pendingCell) setCell(pendingCell.day, pendingCell.slot, { mode: "generate" });
          setPendingCell(null);
        }}
        onPickFromBook={() => {
          if (pendingCell) setPickerFor(pendingCell);
          setPendingCell(null);
        }}
        onKeep={() => {
          if (pendingCell) {
            const meal = originalMealFor(pendingCell.day, pendingCell.slot);
            if (meal) setCell(pendingCell.day, pendingCell.slot, { mode: "keep", meal });
          }
          setPendingCell(null);
        }}
        onSkip={() => {
          if (pendingCell) setCell(pendingCell.day, pendingCell.slot, { mode: "skip" });
          setPendingCell(null);
        }}
        onClose={() => setPendingCell(null)}
      />

      <RecipePickerModal
        open={pickerFor !== null}
        slot={pickerFor?.slot}
        onPick={(recipe) => {
          if (pickerFor) setCell(pickerFor.day, pickerFor.slot, { mode: "recipe", recipe });
          setPickerFor(null);
        }}
        onClose={() => setPickerFor(null)}
      />
    </Layout>
  );
}
