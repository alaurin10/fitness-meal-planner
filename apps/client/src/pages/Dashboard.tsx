import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useProfile } from "../hooks/useProfile";
import { useCurrentWorkoutPlan } from "../hooks/useWorkoutPlan";
import { useCurrentMealPlan } from "../hooks/useMealPlan";
import {
  localDayKey,
  useMealCompletions,
} from "../hooks/useMealCompletions";
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
  const todayMeals = mealPlan?.planJson.days.find((d) => d.day === todayLabel);
  const mealsForToday = todayMeals?.meals ?? [];
  const nextMeal = findNextMeal(mealsForToday, completions.completed);
  const allDoneToday = mealsForToday.length > 0 && nextMeal === null;
  const todayDayKey = todayLabel;

  return (
    <Layout>
      <PhoneHeader
        greeting={formatDay(today)}
        title={
          <>
            Good day,<br />
            you.
          </>
        }
        subtitle="Today's workout and meals at a glance."
      />

      {/* Today's workout */}
      <div className="px-4 pt-1 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        <Card tone="gradient" className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Today's workout</div>
            <Icon name="dumbbell" size={20} style={{ color: "var(--accent)" }} />
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
                <Chip variant="honey">Session</Chip>
              </div>
              <Link to="/workouts" className="block mt-4">
                <Button className="w-full">
                  View workout
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

        {/* Log weight shortcut */}
        <Link to="/progress" className="block md:col-span-2">
          <Card className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "var(--clay)",
                  color: "var(--sumi)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="scale" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>
                  Log weight
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  Track today's number
                </div>
              </div>
            </div>
            <Icon name="chevron" size={18} style={{ color: "var(--muted)" }} />
          </Card>
        </Link>
      </div>
    </Layout>
  );
}
