import { useEffect, useState } from "react";
import { Card } from "./Card";
import { Icon } from "./Icon";

interface Props {
  /** Kind of plan being generated — controls the sequence of messages. */
  kind: "workout" | "meal";
  /** Estimated total seconds. The progress ring fills toward this target. */
  estimatedSeconds?: number;
}

const WORKOUT_STEPS = [
  "Reading your profile and goals…",
  "Choosing a split for the week…",
  "Selecting exercises and accessories…",
  "Calibrating loads, sets, and reps…",
  "Polishing the final details…",
  "Just a few more seconds…",
];

const MEAL_STEPS = [
  "Reading your profile and targets…",
  "Designing meals for the week…",
  "Balancing protein, carbs, and fat…",
  "Choosing ingredients and steps…",
  "Polishing the final details…",
  "Just a few more seconds…",
];

export function GeneratingProgress({ kind, estimatedSeconds = 45 }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const steps = kind === "workout" ? WORKOUT_STEPS : MEAL_STEPS;

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Cap visual progress at 92% — we don't know exactly when it'll finish,
  // and snapping to 100% feels nicer than overshooting an estimate.
  const pct = Math.min(0.92, elapsed / estimatedSeconds);
  // Move through the messages over the course of estimatedSeconds.
  const messageIndex = Math.min(
    steps.length - 1,
    Math.floor((elapsed / estimatedSeconds) * steps.length),
  );
  const message = steps[messageIndex];

  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <Card tone="gradient">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg
            width={size}
            height={size}
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="color-mix(in srgb, var(--muted) 18%, transparent)"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="var(--accent)"
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              animation: "spin 2.4s linear infinite",
            }}
          >
            <Icon name="sparkle" size={22} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Generating</div>
          <div
            className="font-display"
            style={{
              fontSize: 18,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              marginTop: 2,
              lineHeight: 1.25,
            }}
          >
            {message}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            This usually takes 30–60 seconds. Please keep this tab open.
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
}
