interface Props {
  viewingWeekStart: string;
  thisWeekStart: string;
  nextWeekStart: string;
  onChange: (week: string) => void;
}

const TOGGLE_STYLE = {
  display: "inline-flex",
  background: "var(--bg)",
  borderRadius: 999,
  padding: 3,
  gap: 2,
  border: "1px solid var(--hair)",
  whiteSpace: "nowrap",
} as const;

/** Compact — page headers are tight on space, and "This"/"Next" read fine
 * next to a week-scoped page title without spelling out "week" twice. */
export function WeekSelector({
  viewingWeekStart,
  thisWeekStart,
  nextWeekStart,
  onChange,
}: Props) {
  return (
      <div role="tablist" aria-label="Select week" style={TOGGLE_STYLE}>
        {(
          [
            { key: thisWeekStart, label: "This" },
            { key: nextWeekStart, label: "Next" },
          ] as const
        ).map((opt) => {
          const active = viewingWeekStart === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt.key)}
              className="tappable"
              style={{
                padding: "6px 12px",
                border: "none",
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--sumi)",
                borderRadius: 999,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 180ms, color 180ms",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
  );
}
