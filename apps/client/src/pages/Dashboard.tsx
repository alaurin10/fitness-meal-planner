import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import {
  localDayKey as sharedLocalDayKey,
  startOfWeek as sharedStartOfWeek,
} from "@platform/shared";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CircleButton } from "../components/CircleButton";
import { Icon } from "../components/Icon";
import { Illustration, mealIllustration } from "../components/Illustration";
import { Layout } from "../components/Layout";
import { ProgressRing } from "../components/ProgressRing";
import { Chip, PageHero, Ring } from "../components/Primitives";
import { SkeletonList } from "../components/Skeleton";
import { useProfile } from "../hooks/useProfile";
import { useCurrentWorkoutPlan } from "../hooks/useWorkoutPlan";
import { useCurrentMealPlan } from "../hooks/useMealPlan";
import { useHydration, useLogHydration, useUnlogHydration } from "../hooks/useHydration";
import { useDailySummary } from "../hooks/useDailySummary";
import { useStreaks } from "../hooks/useStreaks";
import {
  localDayKey,
  useMealCompletions,
} from "../hooks/useMealCompletions";
import { useWorkoutCompletions } from "../hooks/useWorkoutCompletions";
import {
  useWorkoutSession,
  sessionProgress,
} from "../hooks/useWorkoutSession";
import { AnimatedNumber } from "../components/Primitives";
import { fireCelebration } from "../lib/confetti";
import { success, tap } from "../lib/haptics";
import type { Meal, MealSlot } from "../lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 5) return "Up late.";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

// Order in which meals are naturally eaten through the day. Meals without
// a slot fall back to their position in the day's array.
const SLOT_ORDER: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 1,
  snack: 2,
  dinner: 3,
};

function slotLabel(slot: MealSlot | undefined, fallbackIndex: number): string {
  if (slot) {
    return { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }[slot];
  }
  return ["Breakfast", "Lunch", "Dinner", "Snack", "Snack", "Snack"][fallbackIndex] ?? "Meal";
}

interface NextMeal {
  meal: Meal;
  index: number;
  label: string;
}

function findNextMeal(meals: Meal[], completed: Set<number>): NextMeal | null {
  if (meals.length === 0) return null;

  // Sort meals into the order they'd naturally be eaten in.
  const sorted = meals
    .map((meal, index) => ({ meal, index }))
    .sort((a, b) => {
      const ao = a.meal.slot ? SLOT_ORDER[a.meal.slot] : 0.5 + a.index;
      const bo = b.meal.slot ? SLOT_ORDER[b.meal.slot] : 0.5 + b.index;
      return ao - bo;
    });

  for (const { meal, index } of sorted) {
    if (!completed.has(index)) {
      return { meal, index, label: slotLabel(meal.slot, index) };
    }
  }
  return null;
}

export function DashboardPage() {
  const weekStartDay = useWeekStartDay();
  const thisWeekStartIso = useMemo(
    () => sharedLocalDayKey(sharedStartOfWeek(new Date(), weekStartDay)),
    [weekStartDay],
  );
  const profileQuery = useProfile();
  const workoutQuery = useCurrentWorkoutPlan();
  const mealQuery = useCurrentMealPlan();
  // Hook calls must run on every render — keep this above the early returns.
  const completions = useMealCompletions(
    mealQuery.data?.id,
    localDayKey(),
  );
  const workoutCompletion = useWorkoutCompletions(
    workoutQuery.data?.id,
    localDayKey(),
  );
  const workoutSession = useWorkoutSession(
    workoutQuery.data?.id,
    localDayKey(),
  );
  const hydrationQuery = useHydration();
  const logHydration = useLogHydration();
  const unlogHydration = useUnlogHydration();
  const summaryQuery = useDailySummary();
  const streaksQuery = useStreaks();
  const prevAllDoneRef = useRef(false);

  // Fire confetti when all 4 categories hit 100%
  const summary = summaryQuery.data;
  const allCategoriesDone = summary
    ? (summary.workout.done || summary.workout.isRestDay) &&
      summary.meals.done &&
      summary.hydration.cups >= summary.hydration.goal
    : false;

  useEffect(() => {
    if (allCategoriesDone && !prevAllDoneRef.current) {
      fireCelebration();
    }
    prevAllDoneRef.current = allCategoriesDone;
  }, [allCategoriesDone]);

  if (profileQuery.isLoading || workoutQuery.isLoading || mealQuery.isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <SkeletonList count={4} />
        </div>
      </Layout>
    );
  }

  const profile = profileQuery.data?.profile;
  const workoutPlan = workoutQuery.data;
  const mealPlan = mealQuery.data;

  const today = new Date();
  const todayLabel = DAY_LABELS[(today.getDay() + 6) % 7];

  if (!profile) {
    return (
      <Layout>
        <PageHero
          eyebrow={formatDay(today)}
          title="Welcome."
          subtitle="Set up your profile so we can shape your first week."
        />
        <div className="px-4 pt-2">
          <Card tone="gradient" style={{ textAlign: "center" }}>
            <Illustration name="welcome" size={170} style={{ margin: "0 auto" }} />
            <div className="title-md" style={{ marginTop: 10 }}>
              Start with your numbers
            </div>
            <p className="text-body" style={{ marginTop: 6, maxWidth: 300, marginInline: "auto" }}>
              Age, sex, weight, experience, and a goal — that's all we need.
            </p>
            <Link to="/profile" className="block mt-5">
              <Button className="w-full">Set up profile</Button>
            </Link>
          </Card>
        </div>
      </Layout>
    );
  }

  const todayWorkout = workoutPlan?.planJson.days.find((d) => d.day === todayLabel);
  const todayExercises = todayWorkout?.exercises ?? [];
  const sessProgress = sessionProgress(workoutSession.session, todayExercises);
  const hasSession = sessProgress.completed > 0 && !workoutCompletion.isComplete;
  const todayMeals = mealPlan?.planJson.days.find((d) => d.day === todayLabel);
  const mealsForToday = todayMeals?.meals ?? [];
  const nextMeal = findNextMeal(mealsForToday, completions.completed);
  const allDoneToday = mealsForToday.length > 0 && nextMeal === null;
  const todayDayKey = todayLabel ?? "Mon";

  // Lead with whichever card is actionable right now: once the workout is
  // done (or it's a rest day) and a meal is still pending, the meal comes first.
  const workoutSettled =
    workoutCompletion.isComplete || (workoutPlan != null && !todayWorkout);
  const mealCardFirst = nextMeal != null && workoutSettled;

  return (
    <Layout>
      {/* Masthead: time-aware greeting over the date, streak pill below */}
      <PageHero
        eyebrow={formatDay(today)}
        title={greeting(today)}
        below={
          streaksQuery.data && streaksQuery.data.overall.current > 0 ? (
            <Link
              to="/progress"
              viewTransition
              className="chip chip-honey tappable"
              style={{ marginTop: 10, textDecoration: "none", fontWeight: 600 }}
            >
              <Icon name="flame" size={14} />
              {streaksQuery.data.overall.current} day streak
            </Link>
          ) : undefined
        }
      />

      {/* Today's progress — one big completion arc, category rows beside it */}
      {summary && (() => {
        const workoutFrac = summary.workout.isRestDay
          ? 1
          : summary.workout.total > 0
            ? summary.workout.completed / summary.workout.total
            : 0;
        const calFrac = summary.targets.caloricTarget
          ? Math.min(summary.meals.calories / summary.targets.caloricTarget, 1)
          : 0;
        const proteinFrac = summary.targets.proteinTargetG
          ? Math.min(summary.meals.protein / summary.targets.proteinTargetG, 1)
          : 0;
        const hydraFrac = summary.hydration.goal > 0
          ? Math.min(summary.hydration.cups / summary.hydration.goal, 1)
          : 0;
        const overall = (workoutFrac + calFrac + proteinFrac + hydraFrac) / 4;
        return (
          <div className="px-4 pt-1 pb-2 fade-up">
            <Card tone="glass" className="texture-grain">
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                {allCategoriesDone ? "Everything done today" : "Today's progress"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {allCategoriesDone ? (
                  <Illustration name="all-done" size={120} className="fade-up" style={{ flexShrink: 0 }} />
                ) : (
                  <Ring value={overall} size={108} stroke={10} gradient>
                    <span className="display-stat" style={{ fontSize: 27 }}>
                      {Math.round(overall * 100)}
                      <span style={{ fontSize: 14, fontWeight: 400 }}>%</span>
                    </span>
                  </Ring>
                )}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                  <StatRow
                    label="Workout"
                    value={summary.workout.isRestDay
                      ? "Rest"
                      : summary.workout.done
                        ? "Done"
                        : `${summary.workout.completed}/${summary.workout.total}`}
                    fraction={workoutFrac}
                    color="var(--moss)"
                    done={summary.workout.done || summary.workout.isRestDay}
                  />
                  <StatRow
                    label="Calories"
                    value={summary.targets.caloricTarget
                      ? `${summary.meals.calories} / ${summary.targets.caloricTarget}`
                      : String(summary.meals.calories)}
                    fraction={calFrac}
                    color="var(--accent)"
                    done={summary.meals.done}
                  />
                  <StatRow
                    label="Protein"
                    value={summary.targets.proteinTargetG
                      ? `${summary.meals.protein} / ${summary.targets.proteinTargetG}g`
                      : `${summary.meals.protein}g`}
                    fraction={proteinFrac}
                    color="var(--honey)"
                    done={false}
                  />
                  <StatRow
                    label="Water"
                    value={`${summary.hydration.cups} / ${summary.hydration.goal}`}
                    fraction={hydraFrac}
                    color={hydraFrac >= 1 ? "var(--moss)" : "var(--accent)"}
                    done={hydraFrac >= 1}
                  />
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Today's workout — a full accent statement block when there's a session */}
      <div className="px-4 pt-1 flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 stagger-in">
        <Card
          tone={todayWorkout ? "accent" : "gradient"}
          raised
          style={{ order: mealCardFirst ? 2 : 1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Today's workout</div>
            {hasSession ? (
              <ProgressRing
                value={sessProgress.fraction}
                size={36}
                strokeWidth={3.5}
                fillColor="var(--on-accent)"
                trackColor="color-mix(in srgb, var(--on-accent) 25%, transparent)"
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--on-accent)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {Math.round(sessProgress.fraction * 100)}%
                </span>
              </ProgressRing>
            ) : workoutCompletion.isComplete ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--on-accent)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="check" size={18} stroke={2.5} />
              </div>
            ) : (
              <Icon
                name="dumbbell"
                size={22}
                style={{ color: todayWorkout ? "var(--on-accent)" : "var(--accent)" }}
              />
            )}
          </div>
          {todayWorkout ? (
            <>
              <div className="title-lg">{todayWorkout.focus}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Chip>{todayWorkout.exercises.length} exercises</Chip>
                {hasSession ? (
                  <Chip variant="honey">{sessProgress.completed}/{sessProgress.total} sets</Chip>
                ) : workoutCompletion.isComplete ? (
                  <Chip variant="honey">Done</Chip>
                ) : (
                  <Chip variant="honey">Session</Chip>
                )}
              </div>
              <Link to="/workouts" className="block mt-4">
                <Button className="w-full">
                  {hasSession ? "Resume workout" : workoutCompletion.isComplete ? "View workout" : "View workout"}
                  <Icon name="chevron" size={16} />
                </Button>
              </Link>
            </>
          ) : workoutPlan ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Illustration name="rest-day" size={84} style={{ flexShrink: 0 }} />
                <div>
                  <div className="title-lg">Rest day</div>
                  <p className="text-body" style={{ marginTop: 4 }}>
                    Recover well.
                  </p>
                </div>
              </div>
              <Link to="/workouts" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See full week
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="title-lg">No plan yet</div>
              <Link to="/workouts" className="block mt-4">
                <Button className="w-full">
                  <Icon name="sparkle" size={16} />
                  Generate workouts
                </Button>
              </Link>
            </>
          )}
        </Card>

        {/* Next meal */}
        <Card
          tone="clay"
          raised
          style={{ order: mealCardFirst ? 1 : 2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">
              {nextMeal ? `Next up · ${nextMeal.label}` : "Today's meals"}
            </div>
            <Icon name="leaf" size={20} style={{ color: "var(--moss)" }} />
          </div>
          {nextMeal ? (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* One-tap quick complete for the most common daily action */}
                <CircleButton
                  onClick={() => {
                    success();
                    completions.toggle(nextMeal.index);
                    if (completions.completed.size === mealsForToday.length - 1) {
                      setTimeout(() => fireCelebration(), 200);
                    }
                  }}
                  aria-label={`Mark ${nextMeal.meal.name} eaten`}
                  style={{ marginTop: 2 }}
                >
                  <Icon name="check" size={16} stroke={2} />
                </CircleButton>
                <Link
                  to={`/meals/${thisWeekStartIso}/${todayDayKey}/${nextMeal.index}`}
                  viewTransition
                  className="block tappable"
                  style={{ color: "inherit", textDecoration: "none", flex: 1, minWidth: 0 }}
                >
                  <div className="title-md" style={{ lineHeight: 1.2 }}>
                    {nextMeal.meal.name}
                  </div>
                  <div
                    className="text-caption"
                    style={{
                      color: "var(--sumi)",
                      marginTop: 6,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      <b style={{ color: "var(--ink)", fontWeight: 500 }}>{nextMeal.meal.calories}</b> kcal
                    </span>
                    <span>·</span>
                    <span>
                      <b style={{ color: "var(--ink)", fontWeight: 500 }}>{nextMeal.meal.proteinG}</b>g protein
                    </span>
                  </div>
                </Link>
                <Illustration
                  name={mealIllustration(nextMeal.meal.slot)}
                  size={72}
                  style={{ flexShrink: 0, marginTop: -4 }}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Link
                  to={`/meals/${thisWeekStartIso}/${todayDayKey}/${nextMeal.index}`}
                  viewTransition
                  className="flex-1"
                >
                  <Button variant="accent" className="w-full">
                    Open recipe
                    <Icon name="chevron" size={16} />
                  </Button>
                </Link>
                <Link to="/meals" viewTransition className="flex-1">
                  <Button variant="ghost" className="w-full">
                    See day
                  </Button>
                </Link>
              </div>
            </>
          ) : allDoneToday ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Illustration name="meals-done" size={84} style={{ flexShrink: 0 }} />
                <div>
                  <div className="title-lg">All done for today</div>
                  <p className="text-body" style={{ marginTop: 4 }}>
                    Nicely fueled — see you in the morning.
                  </p>
                </div>
              </div>
              <Link to="/meals" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See today's meals
                </Button>
              </Link>
            </>
          ) : mealPlan ? (
            <>
              <div className="title-lg">No meals today</div>
              <Link to="/meals" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See full week
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="title-lg">No plan yet</div>
              <Link to="/meals" className="block mt-4">
                <Button variant="accent" className="w-full">
                  <Icon name="sparkle" size={16} />
                  Generate meals
                </Button>
              </Link>
            </>
          )}
        </Card>
      </div>

      {/* Hydration tracker */}
      <HydrationCard
        cups={hydrationQuery.data?.cups ?? 0}
        goal={profileQuery.data?.profile?.hydrationGoal ?? 8}
        onAdd={() => {
          const goal = profileQuery.data?.profile?.hydrationGoal ?? 8;
          if ((hydrationQuery.data?.cups ?? 0) + 1 >= goal) success();
          else tap();
          logHydration.mutate();
        }}
        onRemove={() => {
          tap();
          unlogHydration.mutate();
        }}
        loading={hydrationQuery.isLoading}
      />
    </Layout>
  );
}

function StatRow({
  label,
  value,
  fraction,
  color,
  done,
}: {
  label: string;
  value: string;
  fraction: number;
  color: string;
  done: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {done ? (
        <span style={{ color, display: "inline-flex", flexShrink: 0, animation: "checkPop 260ms ease" }}>
          <Icon name="check" size={13} stroke={3} />
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            flexShrink: 0,
            background: `conic-gradient(${color} ${Math.round(fraction * 360)}deg, color-mix(in srgb, var(--muted) 20%, transparent) 0deg)`,
          }}
        />
      )}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        className="font-display"
        style={{ fontSize: 13.5, color: done ? color : "var(--sumi)", letterSpacing: "-0.01em" }}
      >
        {value}
      </span>
    </div>
  );
}

function HydrationCard({
  cups,
  goal,
  onAdd,
  onRemove,
  loading,
}: {
  cups: number;
  goal: number;
  onAdd: () => void;
  onRemove: () => void;
  loading: boolean;
}) {
  const reached = cups >= goal;
  const level = goal > 0 ? Math.min(cups / goal, 1) : 0;
  return (
    <div className="px-4 pt-3 fade-up">
      <Card flush style={{ overflow: "hidden" }}>
        {/* Water level rises with each logged cup */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${level * 100}%`,
            background: reached
              ? "color-mix(in srgb, var(--moss) 14%, transparent)"
              : "color-mix(in srgb, var(--accent) 11%, transparent)",
            transition: "height 600ms cubic-bezier(0.2, 0.8, 0.2, 1), background 300ms ease",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", padding: "var(--pad-card)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Hydration</div>
          <Icon name="water" size={20} style={{ color: "var(--accent)" }} />
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing
            value={goal > 0 ? Math.min(cups / goal, 1) : 0}
            size={64}
            strokeWidth={5}
            fillColor={reached ? "var(--moss)" : "var(--accent)"}
            gradient={reached}
          >
            <span
              className="font-display"
              style={{
                fontSize: 18,
                color: reached ? "var(--moss)" : "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              <AnimatedNumber value={cups} />
            </span>
          </ProgressRing>

          <div className="flex-1">
            <div className="title-md">
              {reached ? "Goal reached" : `${cups} / ${goal} cups`}
            </div>
            <p className="text-body" style={{ marginTop: 4 }}>
              {reached ? "Well hydrated — keep it up." : "Tap to log a drink."}
            </p>
          </div>

          {!loading && (
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              {cups > 0 && (
                <CircleButton
                  onClick={onRemove}
                  aria-label="Remove cup"
                  style={{ color: "var(--sumi)" }}
                >
                  <Icon name="minus" size={16} stroke={2.5} />
                </CircleButton>
              )}
              <CircleButton
                size={44}
                variant={reached ? "soft" : "accent"}
                onClick={onAdd}
                aria-label="Add cup"
              >
                <Icon name="plus" size={20} stroke={2.5} />
              </CircleButton>
            </div>
          )}
        </div>
        </div>
      </Card>
    </div>
  );
}
