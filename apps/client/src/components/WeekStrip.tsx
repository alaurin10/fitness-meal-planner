import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import {
  localDayKey,
  readMealCompletions,
} from "../hooks/useMealCompletions";
import { readWorkoutCompletion } from "../hooks/useWorkoutCompletions";
import type { MealDay } from "../lib/types";
import type { TrainingDay, WeeklyPlanRecord } from "../hooks/useWorkoutPlan";
import type { WeeklyMealPlanRecord } from "../lib/types";

interface WeekStripProps {
  mealPlan: WeeklyMealPlanRecord | null | undefined;
  workoutPlan: WeeklyPlanRecord | null | undefined;
}

const DAY_LABELS: MealDay["day"][] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const SHORT_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Local Monday at 00:00 of the current week. */
function startOfWeekLocal(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function WeekStrip({ mealPlan, workoutPlan }: WeekStripProps) {
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const monday = startOfWeekLocal(today);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 6,
      }}
    >
      {DAY_LABELS.map((dayLabel, i) => {
        const date = addDays(monday, i);
        const dayKey = localDayKey(date);
        const isToday = i === todayDow;
        const isPast = i < todayDow;
        const isFuture = i > todayDow;

        const mealsForDay =
          mealPlan?.planJson.days.find((d) => d.day === dayLabel)?.meals ?? [];
        const trainingDay: TrainingDay | undefined =
          workoutPlan?.planJson.days.find((d) => d.day === dayLabel);
        const exerciseCount = trainingDay?.exercises.length ?? 0;
        const hasWorkout = exerciseCount > 0;

        const completedMealIdxs = readMealCompletions(mealPlan?.id, dayKey);
        const workoutDone = readWorkoutCompletion(workoutPlan?.id, dayKey);

        return (
          <Link
            key={dayLabel}
            to="/meals"
            aria-label={`${dayLabel}${isToday ? " · today" : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "8px 4px 10px",
              borderRadius: 12,
              background: isToday ? "var(--paper)" : "transparent",
              border: isToday
                ? "1px solid color-mix(in srgb, var(--accent) 50%, var(--hair))"
                : "1px solid transparent",
              opacity: isFuture ? 0.6 : 1,
              textDecoration: "none",
              color: "inherit",
              minHeight: 64,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isToday ? "var(--accent-2)" : "var(--muted)",
                fontWeight: isToday ? 600 : 500,
              }}
            >
              {SHORT_LABELS[i]}
            </span>

            {/* Workout glyph (only when there's a session that day). */}
            <span
              style={{
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: hasWorkout
                  ? workoutDone
                    ? "var(--moss)"
                    : isPast
                      ? "color-mix(in srgb, var(--rose) 50%, var(--muted))"
                      : "var(--muted)"
                  : "transparent",
              }}
            >
              {hasWorkout && (
                <Icon name="dumbbell" size={14} stroke={workoutDone ? 2.4 : 1.6} />
              )}
            </span>

            {/* Meal dots */}
            <span
              style={{
                display: "flex",
                gap: 3,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 6,
              }}
            >
              {mealsForDay.map((_, mi) => {
                const done = completedMealIdxs.has(mi);
                const missed = isPast && !done;
                return (
                  <span
                    key={mi}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: done
                        ? "var(--moss)"
                        : missed
                          ? "color-mix(in srgb, var(--rose) 30%, var(--hair))"
                          : "var(--hair)",
                    }}
                  />
                );
              })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
