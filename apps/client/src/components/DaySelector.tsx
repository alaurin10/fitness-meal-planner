/**
 * Week day-pill strip shared by Meals and Workouts. Horizontal on mobile
 * (scrolls away with the page content); vertical column on desktop.
 */
export function DaySelector<D extends string>({
  days,
  counts,
  activeDay,
  todayDay,
  weekStartDate,
  onChange,
  isDesktop,
}: {
  days: readonly D[];
  /** Per-day item count, indexed like `days`. 0 renders as "·". */
  counts: number[];
  activeDay: D;
  todayDay?: D;
  weekStartDate: Date;
  onChange: (day: D) => void;
  isDesktop: boolean;
}) {
  return (
    <div
      style={
        isDesktop
          ? { paddingTop: 4 }
          : {
              padding: "4px 16px 8px",
              overflowX: "auto",
            }
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "column" : "row",
          gap: 6,
        }}
      >
        {days.map((d, i) => {
          const isActive = activeDay === d;
          const isToday = d === todayDay;
          const dayDate = new Date(weekStartDate);
          dayDate.setDate(weekStartDate.getDate() + i);
          const count = counts[i] ?? 0;
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className="tappable"
              aria-pressed={isActive}
              style={{
                flex: isDesktop ? "none" : 1,
                minWidth: isDesktop ? undefined : 56,
                border: isActive ? "none" : "1px solid var(--hair)",
                background: isActive
                  ? "linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--honey)))"
                  : "var(--paper)",
                color: isActive ? "var(--on-accent)" : "var(--ink)",
                boxShadow: isActive
                  ? "0 4px 14px color-mix(in srgb, var(--accent) 32%, transparent)"
                  : "var(--shadow-sm)",
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
                transition: "background 180ms ease, color 180ms ease, box-shadow 180ms ease",
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
              <span className="font-display" style={{ fontSize: 19, lineHeight: 1.1 }}>
                {dayDate.getDate()}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  opacity: 0.55,
                  lineHeight: 1,
                }}
              >
                {count > 0 ? count : "·"}
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
  );
}
