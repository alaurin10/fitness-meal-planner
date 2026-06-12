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

const PAD = 4;
const GAP = 4;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  minSegmentWidth = 72,
  className,
  ...rest
}: Props<T>) {
  const activeIndex = options.findIndex((option) => option.value === value);
  return (
    <div
      role="group"
      aria-label={rest["aria-label"]}
      className={className}
      style={{
        position: "relative",
        display: "inline-grid",
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: GAP,
        padding: PAD,
        borderRadius: 999,
        border: "1px solid var(--hair)",
        background: "color-mix(in srgb, var(--clay) 45%, var(--paper))",
      }}
    >
      {activeIndex >= 0 && (
        <div
          aria-hidden
          // Class lets the theme crossfade rule in tokens.css preserve this
          // transition (its blanket !important override would kill the slide).
          className="segmented-thumb"
          style={{
            position: "absolute",
            top: PAD,
            bottom: PAD,
            left: PAD,
            // 100% is the container's padding box, so subtract both side
            // paddings and the inter-segment gaps to get one segment's width.
            width: `calc((100% - ${PAD * 2}px - ${(options.length - 1) * GAP}px) / ${options.length})`,
            borderRadius: 999,
            background: "var(--ink)",
            // Each step travels one segment width plus the gap beside it.
            transform: `translateX(calc(${activeIndex} * (100% + ${GAP}px)))`,
            transition: "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      )}
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
              position: "relative",
              zIndex: 1,
              minWidth: minSegmentWidth,
              padding: "10px 14px",
              border: "none",
              borderRadius: 999,
              background: "transparent",
              color: active ? "var(--bg)" : "var(--sumi)",
              fontSize: 12,
              fontWeight: 600,
              // Matches the thumb's travel time so the label flip reads as
              // the thumb arriving rather than a separate change.
              transition: "color 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
