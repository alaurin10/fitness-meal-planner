import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useProfile } from "../hooks/useProfile";
import { useCurrentWorkoutPlan } from "../hooks/useWorkoutPlan";
import { useCurrentMealPlan } from "../hooks/useMealPlan";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DashboardPage() {
  const profileQuery = useProfile();
  const workoutQuery = useCurrentWorkoutPlan();
  const mealQuery = useCurrentMealPlan();

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
  const mealKcal = todayMeals?.meals.reduce((s, m) => s + m.calories, 0) ?? 0;
  const mealProtein = todayMeals?.meals.reduce((s, m) => s + m.proteinG, 0) ?? 0;

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
      <div className="px-4 pt-1">
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
      </div>

      {/* Today's meals */}
      <div className="px-4 pt-3">
        <Card tone="clay" className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Today's meals</div>
            <Icon name="leaf" size={20} style={{ color: "var(--moss)" }} />
          </div>
          {todayMeals && todayMeals.meals.length > 0 ? (
            <>
              <div
                className="font-display"
                style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {todayMeals.meals.length} meals
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
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>{mealKcal}</b> kcal
                </span>
                <span>·</span>
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>{mealProtein}</b>g protein
                </span>
              </div>
              <Link to="/meals" className="block mt-4">
                <Button variant="accent" className="w-full">
                  View meals
                  <Icon name="chevron" size={16} />
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

      {/* Log weight shortcut */}
      <div className="px-4 pt-3">
        <Link to="/progress" className="block">
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
