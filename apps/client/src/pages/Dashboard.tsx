import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { ProgressRing } from "../components/ProgressRing";
import { Chip, PhoneHeader, Ring } from "../components/Primitives";
import { useProfile } from "../hooks/useProfile";
import { useCurrentWorkoutPlan } from "../hooks/useWorkoutPlan";
import { useCurrentMealPlan } from "../hooks/useMealPlan";
import { useHydration, useLogHydration } from "../hooks/useHydration";
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
import { fireCelebration } from "../lib/confetti";
import type { Meal, MealSlot } from "../lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
          <Card>Loading…</Card>
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
        <PhoneHeader
          greeting={formatDay(today)}
          title="Welcome."
          subtitle="Set up your profile so we can shape your first week."
        />
        <div className="px-4 pt-2">
          <Card tone="gradient">
            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "var(--paper)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="sparkle" size={18} />
              </div>
              <div>
                <div
                  className="font-display"
                  style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}
                >
                  Start with your numbers
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--sumi)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  Age, sex, weight, experience, and a goal — that's all we need.
                </p>
              </div>
            </div>
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

  return (
    <Layout>
      <div
        className="font-display"
        style={{
          padding: "20px 22px 14px",
          fontSize: 36,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
        }}
      >
        {formatDay(today)}
      </div>

      {/* Streak badge */}
      {streaksQuery.data && streaksQuery.data.overall.current > 0 && (
        <Link
          to="/progress"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "0 22px 8px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          <Icon name="flame" size={16} />
          {streaksQuery.data.overall.current} day streak
        </Link>
      )}

      {/* Today's progress rings */}
      {summary && (
        <div className="px-4 pt-1 pb-2 fade-up">
          <Card>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Today's progress</div>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-start" }}>
              <ProgressStat
                label="Workout"
                value={summary.workout.isRestDay
                  ? "Rest"
                  : summary.workout.done
                    ? "Done"
                    : `${summary.workout.completed}/${summary.workout.total}`}
                fraction={summary.workout.isRestDay ? 1 : summary.workout.total > 0
                  ? summary.workout.completed / summary.workout.total : 0}
                color="var(--moss)"
                done={summary.workout.done || summary.workout.isRestDay}
              />
              <ProgressStat
                label="Calories"
                value={summary.meals.calories > 0 ? String(summary.meals.calories) : "0"}
                sublabel={summary.targets.caloricTarget ? `/ ${summary.targets.caloricTarget}` : undefined}
                fraction={summary.targets.caloricTarget
                  ? Math.min(summary.meals.calories / summary.targets.caloricTarget, 1) : 0}
                color="var(--accent)"
                done={summary.meals.done}
              />
              <ProgressStat
                label="Protein"
                value={summary.meals.protein > 0 ? `${summary.meals.protein}g` : "0g"}
                sublabel={summary.targets.proteinTargetG ? `/ ${summary.targets.proteinTargetG}g` : undefined}
                fraction={summary.targets.proteinTargetG
                  ? Math.min(summary.meals.protein / summary.targets.proteinTargetG, 1) : 0}
                color="var(--honey)"
                done={false}
              />
              <ProgressStat
                label="Hydration"
                value={`${summary.hydration.cups}`}
                sublabel={`/ ${summary.hydration.goal}`}
                fraction={summary.hydration.goal > 0
                  ? Math.min(summary.hydration.cups / summary.hydration.goal, 1) : 0}
                color={summary.hydration.cups >= summary.hydration.goal ? "var(--moss)" : "var(--accent)"}
                done={summary.hydration.cups >= summary.hydration.goal}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Today's workout */}
      <div className="px-4 pt-1 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        <Card tone="gradient" className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Today's workout</div>
            {hasSession ? (
              <ProgressRing value={sessProgress.fraction} size={36} strokeWidth={3.5}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--accent)",
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
                  background: "var(--accent)",
                  color: "var(--paper)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="check" size={18} stroke={2.5} />
              </div>
            ) : (
              <Icon name="dumbbell" size={20} style={{ color: "var(--accent)" }} />
            )}
          </div>
          {todayWorkout ? (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {todayWorkout.focus}
              </div>
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
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                Rest day
              </div>
              <p style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6 }}>
                Recover well.
              </p>
              <Link to="/workouts" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See full week
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                No plan yet
              </div>
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
        <Card tone="clay" className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">
              {nextMeal ? `Next up · ${nextMeal.label}` : "Today's meals"}
            </div>
            <Icon name="leaf" size={20} style={{ color: "var(--moss)" }} />
          </div>
          {nextMeal ? (
            <>
              <Link
                to={`/meals/${todayDayKey}/${nextMeal.index}`}
                className="block tappable"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <div
                  className="font-display"
                  style={{
                    fontSize: 22,
                    color: "var(--ink)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  {nextMeal.meal.name}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
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
              <div className="flex gap-2 mt-4">
                <Link to={`/meals/${todayDayKey}/${nextMeal.index}`} className="flex-1">
                  <Button variant="accent" className="w-full">
                    Open recipe
                    <Icon name="chevron" size={16} />
                  </Button>
                </Link>
                <Link to="/meals" className="flex-1">
                  <Button variant="ghost" className="w-full">
                    See day
                  </Button>
                </Link>
              </div>
            </>
          ) : allDoneToday ? (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                All done for today
              </div>
              <p style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6 }}>
                Nicely fueled — see you in the morning.
              </p>
              <Link to="/meals" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See today's meals
                </Button>
              </Link>
            </>
          ) : mealPlan ? (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                No meals today
              </div>
              <Link to="/meals" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  See full week
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                No plan yet
              </div>
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
        onAdd={() => logHydration.mutate()}
        loading={hydrationQuery.isLoading}
      />
    </Layout>
  );
}

function ProgressStat({
  label,
  value,
  sublabel,
  fraction,
  color,
  done,
}: {
  label: string;
  value: string;
  sublabel?: string;
  fraction: number;
  color: string;
  done: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <Ring
        value={fraction}
        size={56}
        stroke={5}
        color={color}
      >
        {done ? (
          <div style={{ color, animation: "checkPop 260ms ease" }}>
            <Icon name="check" size={18} stroke={2.5} />
          </div>
        ) : (
          <span
            className="font-display"
            style={{
              fontSize: 12,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            {value}
          </span>
        )}
      </Ring>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </div>
        {sublabel && !done && (
          <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function HydrationCard({
  cups,
  goal,
  onAdd,
  loading,
}: {
  cups: number;
  goal: number;
  onAdd: () => void;
  loading: boolean;
}) {
  const reached = cups >= goal;
  return (
    <div className="px-4 pt-3 fade-up">
      <Card>
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
          >
            <span
              className="font-display"
              style={{
                fontSize: 18,
                color: reached ? "var(--moss)" : "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {cups}
            </span>
          </ProgressRing>

          <div className="flex-1">
            <div
              className="font-display"
              style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              {reached ? "Goal reached" : `${cups} / ${goal} cups`}
            </div>
            <p style={{ fontSize: 13, color: "var(--sumi)", marginTop: 4 }}>
              {reached ? "Well hydrated — keep it up." : "Tap to log a drink."}
            </p>
          </div>

          {!loading && (
            <button
              type="button"
              onClick={onAdd}
              className="tappable"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: reached ? "var(--clay)" : "var(--accent)",
                color: reached ? "var(--sumi)" : "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: "pointer",
              }}
              aria-label="Add cup"
            >
              <Icon name="plus" size={20} stroke={2.5} />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
