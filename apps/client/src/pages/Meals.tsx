import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rotateDays, dayIdxFromDate, startOfWeek as sharedStartOfWeek, addWeeks, localDayKey, parseLocalDate } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useConfirm } from "../components/ConfirmDialog";
import { DayMacroSummary } from "../components/DayMacroSummary";
import { DaySelector } from "../components/DaySelector";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PlanInfo } from "../components/PlanInfo";
import { PopMenu } from "../components/PopMenu";
import { CircleButton } from "../components/CircleButton";
import { Illustration, mealIllustration } from "../components/Illustration";
import { LeftoverRepairDialog } from "../components/LeftoverRepairDialog";
import { AnimatedNumber, Chip, PageHero } from "../components/Primitives";
import { RecipePickerModal } from "../components/RecipePickerModal";
import { RegenerateHintModal } from "../components/RegenerateHintModal";
import { SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { WeekSelector } from "../components/WeekSelector";
import { useSwipe } from "../hooks/useSwipe";
import { success, tap } from "../lib/haptics";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useProfile } from "../hooks/useProfile";
import {
  useAddSlot,
  useCreateEmptyPlan,
  useCurrentMealPlan,
  useDeleteSlot,
  useGenerateMealPlan,
  useRegenerateDay,
  useRegenerateSlot,
  useReplaceSlot,
  useResolveLeftovers,
  type AffectedLeftover,
  type PlanResult,
} from "../hooks/useMealPlan";
import { useMealCompletions } from "../hooks/useMealCompletions";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import { recipeToMeal } from "../lib/recipeAdapter";
import { fireCelebration } from "../lib/confetti";
import { formatMinutes, formatQuantity, type UnitSystem } from "../lib/units";
import type { Meal, MealDay, MealSlot, RecipeRecord } from "../lib/types";

type PendingPicker =
  | { kind: "replace"; day: MealDay["day"]; index: number; slot?: MealSlot }
  | { kind: "add"; day: MealDay["day"]; slot?: MealSlot };

type PendingHint =
  | { kind: "slot"; day: MealDay["day"]; index: number; mealName: string }
  | { kind: "day"; day: MealDay["day"] };

export function MealsPage() {
  const weekStartDay = useWeekStartDay();
  const DAYS = rotateDays(weekStartDay);
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => localDayKey(sharedStartOfWeek(now, weekStartDay)), [now, weekStartDay]);
  const nextWeekStart = useMemo(
    () => localDayKey(addWeeks(sharedStartOfWeek(now, weekStartDay), 1)),
    [now, weekStartDay],
  );
  const [viewingWeekStart, setViewingWeekStart] = useState(thisWeekStart);
  const viewingWeekStartDate = useMemo(() => parseLocalDate(viewingWeekStart), [viewingWeekStart]);

  const { data: plan, isLoading } = useCurrentMealPlan(viewingWeekStart);
  const generate = useGenerateMealPlan();
  const createEmpty = useCreateEmptyPlan();
  const regenDay = useRegenerateDay();
  const regenSlot = useRegenerateSlot();
  const replaceSlot = useReplaceSlot();
  const addSlot = useAddSlot();
  const deleteSlot = useDeleteSlot();
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const unitSystem: UnitSystem = settings?.unitSystem ?? "imperial";
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const todayIdx = dayIdxFromDate(now, weekStartDay);
  const [activeDay, setActiveDay] = useState<MealDay["day"]>(
    DAYS[todayIdx] ?? "Mon",
  );
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [picker, setPicker] = useState<PendingPicker | null>(null);
  const [hintPrompt, setHintPrompt] = useState<PendingHint | null>(null);
  const resolveLeftovers = useResolveLeftovers();
  const [leftoverRepair, setLeftoverRepair] = useState<{
    source: { day: MealDay["day"]; index: number };
    sourceName: string;
    newSourceName?: string;
    affected: AffectedLeftover[];
  } | null>(null);

  // After a mutation replaced a meal, ask what to do with any leftovers that
  // depended on it. `sourceIndexHint` locates the successor meal when the
  // whole day was regenerated (indices may have changed).
  function maybeOpenLeftoverRepair(data: PlanResult, sourceDay: MealDay["day"], sourceIndexHint?: number) {
    const affected = data.affectedLeftovers;
    if (!affected?.length) return;
    const newDay = data.plan.planJson.days.find((d) => d.day === sourceDay);
    if (!newDay) return;
    let index = sourceIndexHint ?? -1;
    if (index < 0 || index >= newDay.meals.length) {
      const slot = affected[0]?.sourceSlot;
      index = slot ? newDay.meals.findIndex((m) => m.slot === slot) : -1;
    }
    if (index < 0) return; // successor not resolvable — leave the plan be
    setLeftoverRepair({
      source: { day: sourceDay, index },
      sourceName: affected[0]!.sourceName,
      newSourceName: newDay.meals[index]?.name,
      affected,
    });
  }
  const completions = useMealCompletions(plan?.id, localDayKey());
  const viewingToday =
    viewingWeekStart === thisWeekStart && activeDay === DAYS[todayIdx];
  const prevDayCompleteRef = useRef(false);
  // Directional slide when switching days (swipe or pill tap).
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  function changeDay(next: MealDay["day"]) {
    if (next === activeDay) return;
    setSlideDir(DAYS.indexOf(next) > DAYS.indexOf(activeDay) ? "left" : "right");
    setOpenMenu(null);
    setActiveDay(next);
  }

  function stepDay(delta: 1 | -1) {
    const next = DAYS[DAYS.indexOf(activeDay) + delta];
    if (next) changeDay(next);
  }

  const swipe = useSwipe({
    onSwipeLeft: () => stepDay(1),
    onSwipeRight: () => stepDay(-1),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <SkeletonList count={4} />
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout>
        <PageHero
          title="Meals"
          subtitle="No active plan yet."
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
            <EmptyState
              illustration="meal-breakfast"
              title="No active plan"
              body="Build a week by mixing AI-generated meals with picks from your recipe book, or generate the whole week at once."
            >
              <Button
                className="w-full mt-5"
                onClick={() => navigate(`/meals/plan/${viewingWeekStart}`)}
              >
                <Icon name="plan" size={16} />
                Plan {viewingWeekStart === thisWeekStart ? "this week" : "next week"}
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
              >
                <Icon name="sparkle" size={16} />
                Generate the whole week
              </Button>
              <Button
                variant="plain"
                className="w-full mt-2"
                onClick={() => createEmpty.mutate({ targetWeekStart: viewingWeekStart })}
                disabled={createEmpty.isPending}
              >
                <Icon name="plus" size={16} />
                {createEmpty.isPending ? "Starting…" : "Start blank week"}
              </Button>
              {generate.isError && (
                <ErrorState
                  compact
                  error={generate.error}
                  retrying={generate.isPending}
                  onRetry={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
                />
              )}
            </EmptyState>
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
  const isDayRegenerating =
    regenDay.isPending && regenDay.variables?.day === activeDay;
  const anyMutation =
    regenDay.isPending ||
    regenSlot.isPending ||
    replaceSlot.isPending ||
    addSlot.isPending ||
    deleteSlot.isPending;

  function handleRegenerateDay(suggestion?: string) {
    const day = activeDay;
    regenDay.mutate(
      { day, weekStart: viewingWeekStart, suggestion },
      { onSuccess: (data) => maybeOpenLeftoverRepair(data, day) },
    );
  }

  function handleRegenerate(index: number, suggestion?: string) {
    setOpenMenu(null);
    const day = activeDay;
    regenSlot.mutate(
      { day, index, weekStart: viewingWeekStart, suggestion },
      { onSuccess: (data) => maybeOpenLeftoverRepair(data, day, index) },
    );
  }

  function handleOpenSlotHint(index: number) {
    setOpenMenu(null);
    const meal = meals[index];
    setHintPrompt({
      kind: "slot",
      day: activeDay,
      index,
      mealName: meal?.name ?? "meal",
    });
  }

  function handleOpenDayHint() {
    setHintPrompt({ kind: "day", day: activeDay });
  }

  function handleHintSubmit(suggestion: string) {
    if (!hintPrompt) return;
    if (hintPrompt.kind === "slot") {
      const { day, index } = hintPrompt;
      regenSlot.mutate(
        {
          day,
          index,
          weekStart: viewingWeekStart,
          suggestion: suggestion || undefined,
        },
        { onSuccess: (data) => maybeOpenLeftoverRepair(data, day, index) },
      );
    } else {
      const { day } = hintPrompt;
      regenDay.mutate(
        {
          day,
          weekStart: viewingWeekStart,
          suggestion: suggestion || undefined,
        },
        { onSuccess: (data) => maybeOpenLeftoverRepair(data, day) },
      );
    }
  }

  async function handleDelete(index: number) {
    setOpenMenu(null);
    const ok = await confirm({
      title: "Remove this meal?",
      message: "It will be taken off this day and the grocery list updated.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    deleteSlot.mutate({ day: activeDay, index, weekStart: viewingWeekStart });
  }

  function handleSwap(index: number, slotHint?: MealSlot) {
    setOpenMenu(null);
    setPicker({ kind: "replace", day: activeDay, index, slot: slotHint });
  }

  /** The meal a leftover's `leftoverOf` link points at, wherever it now sits. */
  function sourceMealFor(link: { day: MealDay["day"]; slot: MealSlot }) {
    const day = plan!.planJson.days.find((d) => d.day === link.day);
    const index = day?.meals.findIndex((mm) => mm.slot === link.slot) ?? -1;
    if (!day || index < 0) return null;
    return { day: link.day, index, meal: day.meals[index]! };
  }

  /** True when a leftover's name no longer matches its linked source — e.g.
   * the source dinner was replaced after this leftover was created. */
  function isStaleLeftover(meal: Meal): boolean {
    if (!meal.isLeftover || !meal.leftoverOf) return false;
    const source = sourceMealFor(meal.leftoverOf);
    return source == null || source.meal.name !== meal.name;
  }

  // Manual escape hatch for the leftover-repair dialog: lets the user pull a
  // leftover back in sync with its source on demand, in case they missed the
  // dialog when the source was replaced (or dismissed it and changed their
  // mind), rather than only ever getting it as a one-shot popup.
  function handleSyncLeftover(index: number) {
    setOpenMenu(null);
    const meal = meals[index];
    const link = meal?.leftoverOf;
    if (!link) return;
    const source = sourceMealFor(link);
    if (!source) {
      toast.error("Can't find the meal these leftovers came from.");
      return;
    }
    resolveLeftovers.mutate(
      {
        weekStart: viewingWeekStart,
        source: { day: source.day, index: source.index },
        cells: [{ day: activeDay, index }],
        action: "update",
      },
      { onError: (e) => toast.error((e as Error).message) },
    );
  }

  function handleAdd(slotHint?: MealSlot) {
    setPicker({ kind: "add", day: activeDay, slot: slotHint });
  }

  function handlePick(recipe: RecipeRecord) {
    if (!picker) return;
    const meal: Meal = recipeToMeal(recipe);
    if (picker.slot) meal.slot = picker.slot;
    if (picker.kind === "replace") {
      const { day, index } = picker;
      replaceSlot.mutate(
        { day, index, meal, weekStart: viewingWeekStart },
        { onSuccess: (data) => maybeOpenLeftoverRepair(data, day, index) },
      );
    } else {
      addSlot.mutate({ day: picker.day, meal, weekStart: viewingWeekStart });
    }
    setPicker(null);
  }

  const anyError =
    generate.isError ||
    regenDay.isError ||
    regenSlot.isError ||
    replaceSlot.isError ||
    addSlot.isError ||
    deleteSlot.isError;
  const firstError =
    generate.error ||
    regenDay.error ||
    regenSlot.error ||
    replaceSlot.error ||
    addSlot.error ||
    deleteSlot.error;

  // Re-run whichever mutation last failed, using its stored variables.
  function retryErrored() {
    if (generate.isError && generate.variables) generate.mutate(generate.variables);
    else if (regenDay.isError && regenDay.variables) regenDay.mutate(regenDay.variables);
    else if (regenSlot.isError && regenSlot.variables) regenSlot.mutate(regenSlot.variables);
    else if (replaceSlot.isError && replaceSlot.variables) replaceSlot.mutate(replaceSlot.variables);
    else if (addSlot.isError && addSlot.variables) addSlot.mutate(addSlot.variables);
    else if (deleteSlot.isError && deleteSlot.variables) deleteSlot.mutate(deleteSlot.variables);
  }

  return (
    <Layout>
      <PageHero
        title="Meals"
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
      <DaySelector
        days={DAYS}
        counts={DAYS.map(
          (d) => plan.planJson.days.find((pd) => pd.day === d)?.meals.length ?? 0,
        )}
        activeDay={activeDay}
        todayDay={DAYS[todayIdx]}
        weekStartDate={viewingWeekStartDate}
        onChange={changeDay}
        isDesktop={isDesktop}
      />

      <div
        key={activeDay}
        className={
          slideDir ? (slideDir === "left" ? "slide-in-left" : "slide-in-right") : undefined
        }
        {...swipe}
      >
      <div className="px-4 pt-2">
        <Card tone="hero">
          {/* Week-level controls live on the week card, not the masthead —
              they act on the plan being viewed, and the tab header stays a
              single uncrowded row. */}
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 2 }}>
            <div className="eyebrow">{longDay(activeDay)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -4, marginRight: -4 }}>
              <PlanInfo title="About this plan" sections={[{ text: plan.planJson.summary }]} />
              <CircleButton
                aria-label="Plan week"
                onClick={() => navigate(`/meals/plan/${viewingWeekStart}`)}
              >
                <Icon name="plan" size={18} />
              </CircleButton>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="title-lg mt-1">
                {isDayRegenerating ? "Regenerating…" : meals.length ? `${meals.length} meals` : "Nothing planned"}
              </div>
              <div
                className="text-caption"
                style={{
                  color: "var(--sumi)",
                  marginTop: 6,
                  display: "flex",
                  gap: 10,
                }}
              >
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>
                    <AnimatedNumber value={dayKcal} />
                  </b>{" "}
                  kcal
                </span>
                <span>·</span>
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>
                    <AnimatedNumber value={dayProtein} />
                  </b>
                  g protein
                </span>
              </div>
            </div>
            <Illustration
              name={mealIllustration(nextSlotForDay)}
              size={80}
              style={{ flexShrink: 0, marginBottom: -6 }}
            />
          </div>
          <DayMacroSummary
            meals={meals}
            calorieTarget={
              plan.planJson.dailyCalorieTarget ||
              profile?.profile?.caloricTarget ||
              profile?.suggested?.caloricTarget ||
              undefined
            }
            proteinTarget={profile?.profile?.proteinTargetG ?? profile?.suggested?.proteinTargetG}
          />
        </Card>
      </div>

      <div className="px-4 pt-3 space-y-2.5 stagger-in">
        {isDayRegenerating && (
          <GeneratingProgress kind="meal" estimatedSeconds={45} />
        )}
        {!isDayRegenerating && meals.map((m, i) => {
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
                className="flex"
                style={{
                  ...(isRegenTarget ? { opacity: 0.55 } : {}),
                  ...(mealComplete ? {
                    opacity: 0.6,
                    borderLeft: "3px solid var(--accent)",
                  } : {}),
                  transition: "opacity 300ms ease",
                }}
              >
                {/* Leading complete toggle (today only) — a proper 36px target
                    instead of the old floating corner button. */}
                {viewingToday && (
                  <div style={{ display: "flex", alignItems: "center", paddingLeft: 12 }}>
                    <CircleButton
                      variant={mealComplete ? "accent" : "outline"}
                      onClick={() => {
                        if (mealComplete) tap();
                        else success();
                        completions.toggle(i);
                        // Fire confetti when completing the last meal
                        if (!mealComplete && completions.completed.size === meals.length - 1) {
                          setTimeout(() => fireCelebration(), 200);
                        }
                      }}
                      aria-label={
                        mealComplete
                          ? `Mark ${m.name} incomplete`
                          : `Mark ${m.name} complete`
                      }
                      style={{ transition: "all 200ms ease" }}
                    >
                      <span
                        key={String(mealComplete)}
                        className={mealComplete ? "check-pop" : undefined}
                        style={{ display: "inline-flex" }}
                      >
                        <Icon name="check" size={16} stroke={mealComplete ? 2.4 : 2} />
                      </span>
                    </CircleButton>
                  </div>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  className="tappable"
                  onClick={() =>
                    navigate(`/meals/${viewingWeekStart}/${activeDay}/${i}`, {
                      viewTransition: true,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/meals/${viewingWeekStart}/${activeDay}/${i}`, {
                        viewTransition: true,
                      });
                    }
                  }}
                  style={{ flex: 1, minWidth: 0, display: "flex", cursor: "pointer" }}
                >
                {!viewingToday && (
                  <div
                    aria-hidden
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 10,
                      flexShrink: 0,
                    }}
                  >
                    <Illustration name={mealIllustration(m.slot)} size={56} />
                  </div>
                )}
                <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
                  <div className="eyebrow" style={{ paddingRight: 40 }}>
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
                    {mealComplete && <Chip>Eaten</Chip>}
                    <Chip variant="moss">{m.proteinG}g protein</Chip>
                    {m.isLeftover &&
                      (isStaleLeftover(m) ? (
                        <Chip variant="honey">
                          <Icon name="swap" size={11} /> Out of sync
                        </Chip>
                      ) : (
                        <Chip variant="ghost">
                          <Icon name="swap" size={11} /> Leftovers
                        </Chip>
                      ))}
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
                </div>
              </Card>

              {/* Outside the flush card so the dropdown isn't clipped. */}
              <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
                <PopMenu
                  open={openMenu === i}
                  onToggle={() => setOpenMenu(openMenu === i ? null : i)}
                  disabled={anyMutation}
                  aria-label="Meal options"
                  items={[
                    { icon: "sparkle", label: "Regenerate", onSelect: () => handleRegenerate(i) },
                    {
                      icon: "sparkle",
                      label: "Regenerate with hint…",
                      onSelect: () => handleOpenSlotHint(i),
                    },
                    {
                      icon: "swap",
                      label: "Swap from book",
                      onSelect: () => handleSwap(i, m.slot ?? undefined),
                    },
                    ...(m.isLeftover && m.leftoverOf
                      ? [
                          {
                            icon: "swap" as const,
                            label: isStaleLeftover(m)
                              ? `Update to match ${longDay(m.leftoverOf.day)}'s dinner`
                              : "Re-sync with source meal",
                            onSelect: () => handleSyncLeftover(i),
                          },
                        ]
                      : []),
                    { icon: "x", label: "Remove", tone: "rose", onSelect: () => handleDelete(i) },
                  ]}
                />
              </div>
            </div>
          );
        })}

        {/* Slots the recurring schedule template skips this week. Informational,
            with a one-tap escape hatch to plan the meal anyway. */}
        {!isDayRegenerating &&
          (settings?.mealSchedule?.[activeDay] ?? [])
            .filter((slot) => !meals.some((m) => m.slot === slot))
            .map((slot) => (
              <SkippedSlotRow
                key={`skip-${slot}`}
                slot={slot}
                onPlan={() => handleAdd(slot)}
                disabled={anyMutation}
              />
            ))}

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
        {(generate.isPending || isDayRegenerating) && (
          <GeneratingProgress kind="meal" estimatedSeconds={60} />
        )}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => handleRegenerateDay()}
          disabled={anyMutation}
        >
          <Icon name="sparkle" size={16} />
          {isDayRegenerating
            ? "Regenerating…"
            : `Regenerate ${longDay(activeDay)}`}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={handleOpenDayHint}
          disabled={anyMutation}
        >
          <Icon name="sparkle" size={16} />
          {`Regenerate ${longDay(activeDay)} with hint…`}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
          disabled={anyMutation}
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
          onClick={async () => {
            const ok = await confirm({
              title: "Start a blank week?",
              message: "This replaces the current plan with an empty week. Auto grocery items will be cleared.",
              confirmLabel: "Start blank",
              destructive: true,
            });
            if (ok) createEmpty.mutate({ targetWeekStart: viewingWeekStart });
          }}
          disabled={createEmpty.isPending}
        >
          <Icon name="plus" size={16} />
          {createEmpty.isPending ? "Starting…" : "Start blank week"}
        </Button>
        {anyError && (
          <ErrorState compact error={firstError} onRetry={retryErrored} retrying={anyMutation} />
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
      <LeftoverRepairDialog
        open={leftoverRepair !== null}
        sourceName={leftoverRepair?.sourceName ?? ""}
        newSourceName={leftoverRepair?.newSourceName}
        affected={leftoverRepair?.affected ?? []}
        busy={resolveLeftovers.isPending}
        onUpdate={() => {
          if (!leftoverRepair) return;
          resolveLeftovers.mutate(
            {
              weekStart: viewingWeekStart,
              source: leftoverRepair.source,
              cells: leftoverRepair.affected.map((a) => ({ day: a.day, index: a.index })),
              action: "update",
            },
            { onSettled: () => setLeftoverRepair(null) },
          );
        }}
        onRegenerate={() => {
          if (!leftoverRepair) return;
          resolveLeftovers.mutate(
            {
              weekStart: viewingWeekStart,
              source: leftoverRepair.source,
              cells: leftoverRepair.affected.map((a) => ({ day: a.day, index: a.index })),
              action: "regenerate",
            },
            { onSettled: () => setLeftoverRepair(null) },
          );
        }}
        onClose={() => setLeftoverRepair(null)}
      />
      <RegenerateHintModal
        open={hintPrompt !== null}
        title={
          hintPrompt?.kind === "slot"
            ? `Regenerate ${hintPrompt.mealName} with a hint`
            : hintPrompt?.kind === "day"
              ? `Regenerate ${longDay(hintPrompt.day)} with a hint`
              : ""
        }
        onSubmit={handleHintSubmit}
        onClose={() => setHintPrompt(null)}
      />
      {confirmDialog}
    </Layout>
  );
}

function SkippedSlotRow({
  slot,
  onPlan,
  disabled,
}: {
  slot: MealSlot;
  onPlan: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        border: "1.5px dashed var(--hair)",
        borderRadius: "var(--radius)",
        color: "var(--muted)",
      }}
    >
      <Icon name="x" size={15} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, textTransform: "capitalize", color: "var(--sumi)" }}>
          {slot}
        </span>{" "}
        · skipped this week
      </div>
      <button
        type="button"
        onClick={onPlan}
        disabled={disabled}
        className="tappable"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--accent)",
          fontWeight: 600,
          fontSize: 12.5,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Plan anyway
      </button>
    </div>
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
