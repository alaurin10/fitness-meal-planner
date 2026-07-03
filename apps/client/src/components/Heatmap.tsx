import { useRef, useState, useEffect, useCallback } from "react";
import { rotateDays, dayIdxFromDate, type WeekStartDay } from "@platform/shared";
import { ChartTooltip } from "./ChartTooltip";

interface HeatmapCell {
  date: string;
  level: 0 | 1 | 2 | 3;
}

interface Props {
  data: HeatmapCell[];
  weeks?: number;
  color?: string;
  weekStartDay?: WeekStartDay;
}

const LEVEL_LABELS = ["Nothing logged", "Light day", "Solid day", "Full day"] as const;

/**
 * GitHub-style contribution heatmap. Renders a grid of weeks × 7 days with
 * month labels along the top; color intensity maps to the level (0–3) and
 * hovering/tapping a cell shows a readout.
 */
export function Heatmap({ data, weeks: minWeeks = 12, color = "var(--moss)", weekStartDay = "Mon" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [computedWeeks, setComputedWeeks] = useState(minWeeks);
  const [active, setActive] = useState<{ w: number; d: number } | null>(null);

  const CELL = 14;
  const GAP = 3;
  const LABEL_COL = CELL + 4; // day-label column width
  const MONTH_ROW = 14; // month labels above the grid

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const available = w - LABEL_COL;
    const fitWeeks = Math.floor((available + GAP) / (CELL + GAP));
    setComputedWeeks(Math.max(minWeeks, fitWeeks));
  }, [minWeeks]);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const weeks = computedWeeks;
  const dataMap = new Map(data.map((d) => [d.date, d.level]));

  const rotated = rotateDays(weekStartDay);
  const DAY_LABELS = rotated.map((d, i) => (i % 2 === 0 ? d[0]! : ""));

  // Build grid: last N weeks, rotated day order per column
  const today = new Date();
  const todayDayOfWeek = dayIdxFromDate(today, weekStartDay);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - todayDayOfWeek - (weeks - 1) * 7);

  const columns: { date: Date; key: string; level: number }[][] = [];
  const cursor = new Date(startDate);

  for (let w = 0; w < weeks; w++) {
    const col: { date: Date; key: string; level: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      const isFuture = cursor > today;
      col.push({
        date: new Date(cursor),
        key,
        level: isFuture ? -1 : (dataMap.get(key) ?? 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }

  // Month labels: mark each column whose week contains the 1st of a month
  // (always label the first column so the axis never starts unlabeled).
  const monthLabels = columns.map((col, w) => {
    const firstOfMonth = col.find((c) => c.date.getDate() === 1);
    const d = w === 0 ? col[0]!.date : firstOfMonth?.date;
    return d ? d.toLocaleDateString(undefined, { month: "short" }) : "";
  });

  function cellColor(level: number): string {
    if (level < 0) return "transparent";
    if (level === 0) return "color-mix(in srgb, var(--muted) 10%, transparent)";
    if (level === 1) return `color-mix(in srgb, ${color} 25%, transparent)`;
    if (level === 2) return `color-mix(in srgb, ${color} 55%, transparent)`;
    return color;
  }

  const activeCell = active ? columns[active.w]?.[active.d] : undefined;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {activeCell && activeCell.level >= 0 && (
        <ChartTooltip
          x={LABEL_COL + active!.w * (CELL + GAP) + CELL / 2}
          y={MONTH_ROW + active!.d * (CELL + GAP)}
          seriesColor={cellColor(Math.max(activeCell.level, 1))}
          label={activeCell.date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        >
          {LEVEL_LABELS[activeCell.level]}
        </ChartTooltip>
      )}
      {/* Month labels */}
      <div
        style={{
          display: "flex",
          gap: GAP,
          marginLeft: LABEL_COL,
          height: MONTH_ROW,
        }}
      >
        {monthLabels.map((label, w) => (
          <div
            key={w}
            style={{
              width: CELL,
              flexShrink: 0,
              fontSize: 9,
              color: "var(--muted)",
              overflow: "visible",
              whiteSpace: "nowrap",
            }}
          >
            {/* Hide a label that would collide with the previous one */}
            {label && (w === 0 || monthLabels[w - 1] !== label) && w < weeks - 1 ? label : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4 }} onPointerLeave={() => setActive(null)}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 0 }}>
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                fontSize: 9,
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 2,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display: "flex", gap: 3, overflow: "hidden" }}>
          {columns.map((col, w) => (
            <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {col.map((cell, d) => (
                <div
                  key={cell.key}
                  className="heatmap-cell"
                  onPointerEnter={() => setActive({ w, d })}
                  onPointerDown={() => setActive((a) => (a?.w === w && a?.d === d ? null : { w, d }))}
                  style={{
                    width: 14,
                    height: 14,
                    background: cellColor(cell.level),
                    borderRadius: 3,
                    animation: `fadeUp 300ms ease ${w * 8}ms both`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
