import { useRef, useState } from "react";
import { ChartTooltip } from "./ChartTooltip";

interface BarDay {
  label: string;
  isToday?: boolean;
  isFuture?: boolean;
  values: { color: string; fraction: number; label?: string }[];
}

interface Props {
  days: BarDay[];
  height?: number;
}

/**
 * 7-day grouped bar chart. Each day gets a column with a bar per category;
 * bars grow in from the baseline, today's column sits on an accent wash,
 * and tapping a day shows every series in one readout.
 */
export function WeeklyBars({ days, height = 120 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedDay = selected != null ? days[selected] : undefined;
  const containerWidth = containerRef.current?.clientWidth ?? 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {selectedDay && !selectedDay.isFuture && containerWidth > 0 && (
        <ChartTooltip
          x={((selected! + 0.5) / days.length) * containerWidth}
          y={10}
          label={selectedDay.isToday ? `${selectedDay.label} · today` : selectedDay.label}
        >
          {selectedDay.values.map((v, vi) => (
            <span key={vi} style={{ marginRight: vi < selectedDay.values.length - 1 ? 10 : 0 }}>
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 3,
                  borderRadius: 2,
                  background: v.color,
                  verticalAlign: "middle",
                  marginRight: 5,
                }}
              />
              {Math.round(v.fraction * 100)}%
            </span>
          ))}
        </ChartTooltip>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height }}>
        {days.map((day, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${day.label}${day.isToday ? " (today)" : ""}`}
            onClick={() => setSelected((s) => (s === i ? null : i))}
            onBlur={() => setSelected((s) => (s === i ? null : s))}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              height: "100%",
              border: "none",
              cursor: "pointer",
              padding: "4px 0 0",
              borderRadius: "var(--radius-xs)",
              background: day.isToday ? "var(--wash-accent)" : "transparent",
            }}
          >
            {/* Bar area */}
            <div
              style={{
                flex: 1,
                width: "100%",
                display: "flex",
                gap: 2,
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              {day.values.map((v, vi) => (
                <div
                  key={vi}
                  style={{
                    flex: 1,
                    maxWidth: 12,
                    height: day.isFuture ? 2 : `${Math.max(v.fraction * 100, 2)}%`,
                    background: day.isFuture ? "var(--hair)" : v.color,
                    borderRadius: "4px 4px 0 0",
                    opacity: day.isFuture ? 0.4 : 1,
                    transformOrigin: "bottom",
                    animation: `barGrow 480ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 30}ms both`,
                    transition: "height 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                />
              ))}
            </div>
            {/* Day label */}
            <div
              style={{
                fontSize: 10,
                fontWeight: day.isToday ? 700 : 400,
                color: day.isToday ? "var(--accent)" : "var(--muted)",
                letterSpacing: "0.04em",
                paddingBottom: 3,
              }}
            >
              {day.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
