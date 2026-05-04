import type { WeekKey } from "../hooks/useMealPlan";

interface Props {
  value: WeekKey;
  onChange: (week: WeekKey) => void;
}

const OPTIONS: Array<{ key: WeekKey; label: string }> = [
  { key: "current", label: "This week" },
  { key: "next", label: "Next week" },
];

export function WeekToggle({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Select week"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        background: "var(--paper)",
        border: "1px solid var(--hair)",
        borderRadius: 999,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
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
              borderRadius: 999,
              border: "none",
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--paper)" : "var(--sumi)",
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
