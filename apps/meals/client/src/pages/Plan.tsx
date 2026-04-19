import { useState } from "react";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useCurrentPlan } from "../hooks/usePlan";
import type { MealDay } from "../lib/types";

const DAYS: MealDay["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PlanPage() {
  const { data: plan, isLoading } = useCurrentPlan();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [activeDay, setActiveDay] = useState<MealDay["day"]>(
    DAYS[todayIdx] ?? "Mon",
  );

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
          title="Week plan"
          subtitle="No plan yet. Generate one from the home screen."
        />
      </Layout>
    );
  }

  const dayEntry = plan.planJson.days.find((d) => d.day === activeDay);
  const meals = dayEntry?.meals ?? [];
  const dayKcal = meals.reduce((s, m) => s + m.calories, 0);
  const dayProtein = meals.reduce((s, m) => s + m.proteinG, 0);

  return (
    <Layout>
      <PhoneHeader title="Week plan" subtitle={plan.planJson.summary} />

      {/* Day picker */}
      <div style={{ padding: "4px 16px 8px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6 }}>
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
                  flex: 1,
                  minWidth: 56,
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

      {/* Day totals */}
      <div className="px-4 pt-2">
        <Card tone="clay">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">{longDay(activeDay)}</div>
              <div
                className="font-display mt-1"
                style={{
                  fontSize: 24,
                  color: "var(--ink)",
                  letterSpacing: "-0.01em",
                }}
              >
                {meals.length
                  ? `${meals.length} meals`
                  : "Nothing planned"}
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
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {dayKcal}
                  </b>{" "}
                  kcal
                </span>
                <span>·</span>
                <span>
                  <b style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {dayProtein}
                  </b>
                  g protein
                </span>
              </div>
            </div>
            <Icon
              name="leaf"
              size={36}
              style={{ color: "var(--moss)", flexShrink: 0 }}
            />
          </div>
        </Card>
      </div>

      {/* Meals list */}
      {meals.length > 0 && (
        <div className="px-4 pt-3 space-y-2.5">
          {meals.map((m, i) => (
            <Card key={i} flush className="flex">
              <div
                className="placeholder-photo"
                style={{ width: 96, flexShrink: 0 }}
              >
                {abbr(m.name)}
              </div>
              <div
                style={{
                  padding: "14px 16px",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div className="eyebrow">
                  {mealSlot(i)} · {m.calories} kcal
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
                  {m.name}
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Chip variant="moss">{m.proteinG}g protein</Chip>
                  {m.ingredients.length > 0 && (
                    <Chip variant="ghost">
                      {m.ingredients.length} ingredient
                      {m.ingredients.length === 1 ? "" : "s"}
                    </Chip>
                  )}
                </div>
                {m.ingredients.length > 0 && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--muted)",
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.ingredients
                      .map((ing) => `${ing.qty} ${ing.name}`)
                      .join(" · ")}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
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

function mealSlot(i: number) {
  return ["Breakfast", "Lunch", "Dinner", "Snack", "Snack", "Snack"][i] ?? "Meal";
}

function abbr(s: string) {
  return (s.split(/[·,]/)[0] ?? s)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 14);
}
