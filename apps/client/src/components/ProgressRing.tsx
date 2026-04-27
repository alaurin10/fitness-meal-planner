import type { CSSProperties, ReactNode } from "react";

interface Props {
  /** Progress value between 0 and 1. */
  value: number;
  /** Diameter of the ring in px. */
  size?: number;
  /** Stroke width in px. */
  strokeWidth?: number;
  /** CSS color for the unfilled track. */
  trackColor?: string;
  /** CSS color for the filled arc. */
  fillColor?: string;
  /** Optional content rendered in the centre of the ring. */
  children?: ReactNode;
  style?: CSSProperties;
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  trackColor = "var(--clay)",
  fillColor = "var(--accent)",
  children,
  style,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - clamped);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Filled arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      {children != null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
