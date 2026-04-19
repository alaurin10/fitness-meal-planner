import { useState } from "react";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { useCurrentPlan, type TrainingDay } from "../hooks/usePlan";

const DAYS: TrainingDay["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PlanPage() {
  const { data: plan, isLoading } = useCurrentPlan();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [activeDay, setActiveDay] = useState<TrainingDay["day"]>(
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
        <PhoneHeader title="Week plan" subtitle="No plan yet. Generate one from the home screen." />
      </Layout>
    );
  }

  const dayEntry = plan.planJson.days.find((d) => d.day === activeDay);
  const exercises = dayEntry?.exercises ?? [];

  return (
    <Layout>
      <PhoneHeader title="Week plan" subtitle={plan.planJson.summary} />

      {/* Day picker */}
      <div style={{ padding: "4px 16px 8px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map((d) => {
            const day = plan.planJson.days.find((pd) => pd.day === d);
            const count = day?.exercises.length ?? 0;
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

      {/* Day summary */}
      <div className="px-4 pt-2">
        <Card>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">{longDay(activeDay)}</div>
              <div
                className="font-display mt-1"
                style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {dayEntry?.focus ?? "Rest"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
                {exercises.length
                  ? `${exercises.length} lifts planned.`
                  : "A calm day — recover well."}
              </div>
            </div>
            <Icon
              name="dumbbell"
              size={38}
              style={{ color: "var(--accent)", flexShrink: 0 }}
            />
          </div>
        </Card>
      </div>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="px-4 pt-3">
          <Card flush>
            {exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  padding: "16px 18px",
                  borderBottom:
                    i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "var(--clay)",
                    color: "var(--sumi)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{ fontWeight: 500, fontSize: 14.5, color: "var(--ink)" }}
                    >
                      {ex.name}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}
                    >
                      {ex.loadLbs !== null ? `${ex.loadLbs} lb` : "Bodywt"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span>
                      <b style={{ color: "var(--sumi)", fontWeight: 500 }}>{ex.sets}</b>{" "}
                      × {ex.reps}
                    </span>
                    <span>·</span>
                    <span>{ex.restSeconds}s rest</span>
                  </div>
                  {ex.notes && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--muted)",
                        marginTop: 6,
                        fontStyle: "italic",
                        paddingLeft: 8,
                        borderLeft: "2px solid var(--hair)",
                      }}
                    >
                      {ex.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </Layout>
  );
}

function longDay(d: TrainingDay["day"]) {
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
