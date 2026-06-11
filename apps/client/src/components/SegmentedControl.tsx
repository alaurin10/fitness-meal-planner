interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** Minimum width per segment; defaults suit 2–3 short labels. */
  minSegmentWidth?: number;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  minSegmentWidth = 72,
  className,
  ...rest
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={rest["aria-label"]}
      className={className}
      style={{
        display: "inline-grid",
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: "1px solid var(--hair)",
        background: "color-mix(in srgb, var(--clay) 45%, var(--paper))",
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="tappable"
            aria-pressed={active}
            style={{
              minWidth: minSegmentWidth,
              padding: "10px 14px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--bg)" : "var(--sumi)",
              fontSize: 12,
              fontWeight: 600,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
