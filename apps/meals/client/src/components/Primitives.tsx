import type { CSSProperties, ReactNode } from "react";

export function Eyebrow({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`eyebrow ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Chip({
  variant = "default",
  children,
  style,
}: {
  variant?: "default" | "moss" | "honey" | "ghost";
  children: ReactNode;
  style?: CSSProperties;
}) {
  const cls =
    variant === "moss"
      ? "chip chip-moss"
      : variant === "honey"
        ? "chip chip-honey"
        : variant === "ghost"
          ? "chip chip-ghost"
          : "chip";
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

export function PhoneHeader({
  greeting,
  title,
  subtitle,
  right,
}: {
  greeting?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 22px 10px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {greeting && <div className="eyebrow" style={{ marginBottom: 6 }}>{greeting}</div>}
        <div
          className="font-display"
          style={{
            fontSize: 30,
            color: "var(--ink)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

export function Wordmark({ app }: { app: "fit" | "meals" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50% 50% 50% 0",
          background: "var(--accent)",
          transform: "rotate(-20deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--paper)",
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        <span style={{ transform: "rotate(20deg)" }}>
          {app === "fit" ? "F" : "M"}
        </span>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 18,
          color: "var(--ink)",
          lineHeight: 1,
          letterSpacing: "-0.01em",
        }}
      >
        {app === "fit" ? "Fitness" : "Meals"}
      </div>
    </div>
  );
}

export function Ring({
  value = 0,
  size = 96,
  stroke = 8,
  color,
  track,
  children,
  label,
  sublabel,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: ReactNode;
  sublabel?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track || "color-mix(in srgb, var(--muted) 18%, transparent)"}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || "var(--accent)"}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {children ?? (
          <>
            {label !== undefined && (
              <div
                className="font-display"
                style={{ fontSize: size * 0.24, lineHeight: 1, color: "var(--ink)" }}
              >
                {label}
              </div>
            )}
            {sublabel && (
              <div
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {sublabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  width = 260,
  height = 80,
  color = "var(--accent)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data) - 1;
  const max = Math.max(...data) + 1;
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 16) - 8] as const);
  const path = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1))
    .join(" ");
  const areaPath = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 0} fill={color} />
      ))}
    </svg>
  );
}
