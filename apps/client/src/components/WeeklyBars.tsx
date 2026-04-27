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
 * 7-day grouped bar chart. Each day gets a column with stacked segments
 * for each category. Today's column gets an accent outline.
 */
export function WeeklyBars({ days, height = 120 }: Props) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height }}>
      {days.map((day, i) => {
        const maxFraction = Math.max(
          ...day.values.map((v) => v.fraction),
          0.01,
        );
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              height: "100%",
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
                    height: day.isFuture
                      ? 2
                      : `${Math.max(v.fraction * 100, 2)}%`,
                    background: day.isFuture
                      ? "var(--hair)"
                      : v.color,
                    borderRadius: "3px 3px 0 0",
                    transition: "height 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                    opacity: day.isFuture ? 0.4 : 1,
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
              }}
            >
              {day.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
