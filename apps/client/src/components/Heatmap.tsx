interface HeatmapCell {
  date: string;
  level: 0 | 1 | 2 | 3;
}

interface Props {
  data: HeatmapCell[];
  weeks?: number;
  color?: string;
}

const DAY_LABELS = ["M", "", "W", "", "F", "", ""];

/**
 * GitHub-style contribution heatmap. Renders a grid of weeks × 7 days.
 * Color intensity maps to the level (0–3).
 */
export function Heatmap({ data, weeks = 12, color = "var(--moss)" }: Props) {
  const dataMap = new Map(data.map((d) => [d.date, d.level]));

  // Build grid: last N weeks, Mon–Sun per column
  const today = new Date();
  const todayDayOfWeek = (today.getDay() + 6) % 7; // Mon=0
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

  function cellColor(level: number): string {
    if (level < 0) return "transparent";
    if (level === 0) return "color-mix(in srgb, var(--muted) 10%, transparent)";
    if (level === 1) return `color-mix(in srgb, ${color} 25%, transparent)`;
    if (level === 2) return `color-mix(in srgb, ${color} 55%, transparent)`;
    return color;
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
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
            {col.map((cell) => (
              <div
                key={cell.key}
                className="heatmap-cell"
                title={`${cell.key}: ${cell.level < 0 ? "future" : ["None", "Low", "Medium", "Full"][cell.level]}`}
                style={{
                  width: 14,
                  height: 14,
                  background: cellColor(cell.level),
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
