import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared chart readout: a small glass chip that floats above a mark.
 * Render inside a `position: relative` chart container and pass coordinates
 * in that container's pixel space (x is the anchor center, y its top).
 * Purely presentational — the chart owns hover/tap state and hit targets.
 */
export function ChartTooltip({
  x,
  y,
  seriesColor,
  label,
  children,
}: {
  x: number;
  y: number;
  seriesColor?: string;
  label?: ReactNode;
  /** Value-first content, e.g. <b>2,140</b> kcal */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Clamp horizontally into the chart container so edge marks stay readable.
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const half = el.offsetWidth / 2;
    const overLeft = half - x;
    const overRight = x + half - parent.clientWidth;
    setShift(overLeft > 0 ? overLeft : overRight > 0 ? -overRight : 0);
  }, [x]);

  return (
    <div
      ref={ref}
      role="status"
      className="glass glass-strong fade-up"
      style={{
        position: "absolute",
        left: x + shift,
        top: y,
        transform: "translate(-50%, calc(-100% - 8px))",
        borderRadius: "var(--radius-xs)",
        padding: "6px 10px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 5,
        animationDuration: "160ms",
      }}
    >
      <div
        className="font-display"
        style={{ fontSize: 15, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1.2 }}
      >
        {seriesColor && (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 3,
              borderRadius: 2,
              background: seriesColor,
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />
        )}
        {children}
      </div>
      {label && <div className="text-caption" style={{ marginTop: 1 }}>{label}</div>}
    </div>
  );
}
