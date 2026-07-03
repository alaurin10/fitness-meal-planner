import { useId, type CSSProperties, type ReactNode } from "react";

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
  /** Accent→honey gradient stroke instead of a flat color. */
  gradient?: boolean;
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
  gradient = false,
  children,
  style,
}: Props) {
  const gradId = useId();
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
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={fillColor} />
              <stop offset="100%" stopColor="var(--honey)" />
            </linearGradient>
          </defs>
        )}
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
          stroke={gradient ? `url(#${gradId})` : fillColor}
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
