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
} as const;

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
            { key: thisWeekStart, label: "This week" },
            { key: nextWeekStart, label: "Next week" },
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
                padding: "6px 14px",
                border: "none",
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--sumi)",
                borderRadius: 999,
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
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
