import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import type { Meal, MealSlot } from "../lib/types";

interface DayArcProps {
  /** Today's meals (in plan order). */
  meals: Meal[];
  /** Indexes of meals already marked complete. */
  completedMealIndexes: Set<number>;
  /** Whether today is a workout day with at least one exercise. */
  hasWorkout: boolean;
  workoutComplete: boolean;
  /** Day key used to build /meals/:day/:index links (e.g. "Mon"). */
  todayDayKey: string;
}

/** Static positions along the arc, t ∈ [0,1] from sunrise → night. */
const POS_BREAKFAST = 0.16;
const POS_LUNCH = 0.42;
const POS_SNACK = 0.58;
const POS_WORKOUT = 0.78;
const POS_DINNER = 0.9;

/** Section boundaries — used to label the arc and place the band labels. */
const SECTIONS: Array<{ label: string; center: number }> = [
  { label: "Morning", center: 0.16 },
  { label: "Afternoon", center: 0.5 },
  { label: "Evening", center: 0.84 },
];

/** Arc covers 6 AM → 10 PM (16 hours). */
const ARC_START_HOUR = 6;
const ARC_END_HOUR = 22;

const VIEW_W = 480;
const VIEW_H = 200;
const PAD_X = 28;
const PAD_TOP = 26;
const PAD_BOTTOM = 56; // leaves room for section labels

interface Point {
  x: number;
  y: number;
}

const ARC_START: Point = { x: PAD_X, y: VIEW_H - PAD_BOTTOM };
const ARC_CONTROL: Point = { x: VIEW_W / 2, y: PAD_TOP - 14 };
const ARC_END: Point = { x: VIEW_W - PAD_X, y: VIEW_H - PAD_BOTTOM };

function pointAt(t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * ARC_START.x + 2 * u * t * ARC_CONTROL.x + t * t * ARC_END.x,
    y: u * u * ARC_START.y + 2 * u * t * ARC_CONTROL.y + t * t * ARC_END.y,
  };
}

interface SlotEntry {
  meal: Meal;
  index: number;
}

/**
 * Find the first meal matching the given slot. Falls back to the
 * positional convention (breakfast=0, lunch=1, dinner=2, snack=3+) so
 * meals without slots still land somewhere reasonable.
 */
function findMealForSlot(
  meals: Meal[],
  slot: MealSlot,
  positionalFallback: number,
): SlotEntry | null {
  const direct = meals.findIndex((m) => m.slot === slot);
  if (direct >= 0) {
    const meal = meals[direct];
    if (meal) return { meal, index: direct };
  }
  const fallback = meals[positionalFallback];
  if (fallback && !fallback.slot) {
    return { meal: fallback, index: positionalFallback };
  }
  return null;
}

type MarkerState = "complete" | "upcoming" | "missed";

interface MarkerSpec {
  key: string;
  t: number;
  icon: IconName;
  state: MarkerState;
  href: string;
  ariaLabel: string;
}

export function DayArc({
  meals,
  completedMealIndexes,
  hasWorkout,
  workoutComplete,
  todayDayKey,
}: DayArcProps) {
  // Re-render once a minute so the sun marker keeps creeping along.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sunHour = now.getHours() + now.getMinutes() / 60;
  const sunT = Math.max(
    0,
    Math.min(
      1,
      (sunHour - ARC_START_HOUR) / (ARC_END_HOUR - ARC_START_HOUR),
    ),
  );

  // Build the marker list dynamically — only render meals that exist.
  const markers: MarkerSpec[] = [];

  function pushMeal(slot: MealSlot, t: number, positional: number) {
    const entry = findMealForSlot(meals, slot, positional);
    if (!entry) return;
    const isComplete = completedMealIndexes.has(entry.index);
    markers.push({
      key: `meal-${slot}`,
      t,
      icon: "leaf",
      state: isComplete ? "complete" : t < sunT ? "missed" : "upcoming",
      href: `/meals/${todayDayKey}/${entry.index}`,
      ariaLabel: `${slot} · ${entry.meal.name}${isComplete ? " · complete" : ""}`,
    });
  }

  pushMeal("breakfast", POS_BREAKFAST, 0);
  pushMeal("lunch", POS_LUNCH, 1);
  pushMeal("snack", POS_SNACK, 3);
  pushMeal("dinner", POS_DINNER, 2);

  if (hasWorkout) {
    markers.push({
      key: "workout",
      t: POS_WORKOUT,
      icon: "dumbbell",
      state: workoutComplete
        ? "complete"
        : POS_WORKOUT < sunT
          ? "missed"
          : "upcoming",
      href: "/workouts",
      ariaLabel: workoutComplete ? "Workout · complete" : "Workout",
    });
  }

  const sun = pointAt(sunT);
  const arcPath = `M ${ARC_START.x} ${ARC_START.y} Q ${ARC_CONTROL.x} ${ARC_CONTROL.y} ${ARC_END.x} ${ARC_END.y}`;
  const baselineY = VIEW_H - PAD_BOTTOM;

  return (
    <div
      style={{
        position: "relative",
        background: "var(--paper)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        padding: "10px 4px 4px",
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Today at a glance"
      >
        <defs>
          <linearGradient id="dayArcSky" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="color-mix(in srgb, var(--accent) 22%, transparent)"
            />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <radialGradient id="dayArcSunGlow">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky wash */}
        <path
          d={`${arcPath} L ${ARC_END.x} ${baselineY} L ${ARC_START.x} ${baselineY} Z`}
          fill="url(#dayArcSky)"
        />

        {/* Baseline */}
        <line
          x1={ARC_START.x}
          y1={baselineY}
          x2={ARC_END.x}
          y2={baselineY}
          stroke="var(--hair)"
          strokeWidth={1}
        />

        {/* The arc itself */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--hair)"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* Sun glow + core */}
        <circle cx={sun.x} cy={sun.y} r={26} fill="url(#dayArcSunGlow)" />
        <circle cx={sun.x} cy={sun.y} r={9} fill="var(--accent)" />

        {/* Marker dots (visual only — taps handled by overlay below) */}
        {markers.map((m) => {
          const p = pointAt(m.t);
          const fill =
            m.state === "complete"
              ? "var(--moss)"
              : m.state === "missed"
                ? "color-mix(in srgb, var(--rose) 12%, var(--paper))"
                : "var(--paper)";
          const stroke =
            m.state === "complete"
              ? "var(--moss)"
              : m.state === "missed"
                ? "color-mix(in srgb, var(--rose) 55%, var(--muted))"
                : "var(--hair)";
          return (
            <circle
              key={`dot-${m.key}`}
              cx={p.x}
              cy={p.y}
              r={14}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Section labels under the arc */}
        {SECTIONS.map((s) => {
          const p = pointAt(s.center);
          return (
            <text
              key={s.label}
              x={p.x}
              y={VIEW_H - 18}
              textAnchor="middle"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fill: "var(--muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {s.label}
            </text>
          );
        })}
      </svg>

      {/* Overlay layer: real <Link>s for SPA navigation + the marker
          icons rendered as HTML so the icon component lib stays
          unchanged. Positions are computed from the same Bezier as the
          SVG, expressed in % of the arc box so they scale with it. */}
      <div
        aria-hidden="false"
        style={{
          position: "absolute",
          inset: "10px 4px 4px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: `${(VIEW_H / VIEW_W) * 100}%`,
          }}
        >
          {markers.map((m) => {
            const p = pointAt(m.t);
            const left = (p.x / VIEW_W) * 100;
            const top = (p.y / VIEW_H) * 100;
            const iconColor =
              m.state === "complete"
                ? "var(--paper)"
                : m.state === "missed"
                  ? "color-mix(in srgb, var(--rose) 70%, var(--sumi))"
                  : "var(--sumi)";
            return (
              <Link
                key={`tap-${m.key}`}
                to={m.href}
                aria-label={m.ariaLabel}
                style={{
                  position: "absolute",
                  width: 36,
                  height: 36,
                  left: `calc(${left}% - 18px)`,
                  top: `calc(${top}% - 18px)`,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: iconColor,
                  textDecoration: "none",
                  pointerEvents: "auto",
                }}
              >
                <Icon name={m.icon} size={14} />
                {m.state === "complete" && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      right: 4,
                      bottom: 4,
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: "var(--paper)",
                      color: "var(--moss)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" size={9} stroke={2.5} />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
