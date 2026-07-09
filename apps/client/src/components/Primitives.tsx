import { useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { ChartTooltip } from "./ChartTooltip";

/** Renders a number that tweens toward its target instead of jumping. */
export function AnimatedNumber({ value }: { value: number }) {
  return <>{useAnimatedNumber(value)}</>;
}

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

/**
 * Page masthead: eyebrow → oversized display title → subtitle, with an
 * accent glow bleeding from the top of the page (.page-hero::before).
 * `right` sits beside the title (week selectors, big stats); `below`
 * renders full-width under the text block (chips, illustration).
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  right,
  below,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="page-hero">
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <h1
          className="display-hero text-gradient"
          style={{
            margin: 0,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      {subtitle && (
        <div className="text-body" style={{ color: "var(--muted)", marginTop: 8 }}>
          {subtitle}
        </div>
      )}
      {below}
    </div>
  );
}


export function Wordmark() {
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
        <span style={{ transform: "rotate(20deg)" }}>MF</span>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 17,
          color: "var(--ink)",
          lineHeight: 1,
          letterSpacing: "-0.01em",
        }}
      >
        Meal and Fitness Planner
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
  gradient = false,
  children,
  label,
  sublabel,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Accent→honey gradient stroke instead of a flat color. */
  gradient?: boolean;
  children?: ReactNode;
  label?: ReactNode;
  sublabel?: ReactNode;
}) {
  const gradId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color || "var(--accent)"} />
              <stop offset="100%" stopColor="var(--honey)" />
            </linearGradient>
          </defs>
        )}
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
          stroke={gradient ? `url(#${gradId})` : color || "var(--accent)"}
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
  const gradId = useId();
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
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} style={{ animation: "fadeUp 500ms ease 350ms both" }} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        style={{ animation: "drawLine 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill={color}
        stroke="var(--paper)"
        strokeWidth={2}
        style={{ animation: "fadeUp 300ms ease 550ms both" }}
      />
    </svg>
  );
}

export interface TimeDatum {
  date: Date;
  value: number;
}

export function TimeSparkline({
  data,
  width = 340,
  height = 90,
  color = "var(--accent)",
  formatValue,
}: {
  data: TimeDatum[];
  width?: number;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const gradId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return null;

  const fmt = formatValue ?? ((v: number) => String(Math.round(v)));

  const LEFT = 36;
  const BOTTOM = 18;
  const TOP = 8;
  const RIGHT = 4;
  const plotW = width - LEFT - RIGHT;
  const plotH = height - TOP - BOTTOM;

  const minT = data[0]!.date.getTime();
  const maxT = data[data.length - 1]!.date.getTime();
  const timeRange = maxT - minT || 1;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const vPad = (maxV - minV) * 0.1 || 1;
  const vMin = minV - vPad;
  const vMax = maxV + vPad;
  const vRange = vMax - vMin;

  const pts = data.map((d) => {
    const x = LEFT + ((d.date.getTime() - minT) / timeRange) * plotW;
    const y = TOP + plotH - ((d.value - vMin) / vRange) * plotH;
    return [x, y] as const;
  });

  const path = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1))
    .join(" ");
  const areaPath =
    path + ` L${pts[pts.length - 1]![0].toFixed(1)},${TOP + plotH} L${LEFT},${TOP + plotH} Z`;

  // X-axis labels — first, middle, last
  const xLabels: { x: number; label: string }[] = [];
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (data.length >= 2) {
    xLabels.push({ x: pts[0]![0], label: fmtDate(data[0]!.date) });
    if (data.length >= 4) {
      const mi = Math.floor(data.length / 2);
      xLabels.push({ x: pts[mi]![0], label: fmtDate(data[mi]!.date) });
    }
    xLabels.push({
      x: pts[pts.length - 1]![0],
      label: fmtDate(data[data.length - 1]!.date),
    });
  }

  // Map a pointer event to the nearest datum (the svg may be CSS-scaled
  // down by max-width, so convert client px into viewBox px first).
  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    pts.forEach(([px], i) => {
      const d = Math.abs(px - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  // The svg can be CSS-scaled down by max-width; the HTML tooltip is not,
  // so convert viewBox px → rendered px when positioning it.
  const scale = svgRef.current
    ? svgRef.current.getBoundingClientRect().width / width || 1
    : 1;
  const hoverPt = hover != null ? pts[hover] : undefined;
  const hoverDatum = hover != null ? data[hover] : undefined;

  return (
    <div style={{ position: "relative", maxWidth: "100%" }}>
      {hoverPt && hoverDatum && (
        <ChartTooltip
          x={hoverPt[0] * scale}
          y={hoverPt[1] * scale}
          seriesColor={color}
          label={fmtDate(hoverDatum.date)}
        >
          {fmt(hoverDatum.value)}
        </ChartTooltip>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible", touchAction: "pan-y" }}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis labels */}
        <text x={LEFT - 4} y={TOP + 4} textAnchor="end" fill="var(--muted)" fontSize="9">
          {fmt(maxV)}
        </text>
        <text x={LEFT - 4} y={TOP + plotH} textAnchor="end" fill="var(--muted)" fontSize="9">
          {fmt(minV)}
        </text>

        {/* Grid lines */}
        <line x1={LEFT} y1={TOP} x2={LEFT + plotW} y2={TOP} stroke="var(--hair)" />
        <line x1={LEFT} y1={TOP + plotH} x2={LEFT + plotW} y2={TOP + plotH} stroke="var(--hair)" />

        {/* Crosshair */}
        {hoverPt && (
          <line
            x1={hoverPt[0]}
            y1={TOP}
            x2={hoverPt[0]}
            y2={TOP + plotH}
            stroke="var(--hair)"
            strokeWidth="1"
          />
        )}

        {/* Area + line (traces itself in) */}
        <path d={areaPath} fill={`url(#${gradId})`} style={{ animation: "fadeUp 500ms ease 400ms both" }} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={{ animation: "drawLine 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
        />

        {/* Dots — hovered datum swells; last point always ringed */}
        {pts.map(([x, y], i) => {
          const isLast = i === pts.length - 1;
          const isHover = i === hover;
          if (!isLast && !isHover) {
            return <circle key={i} cx={x} cy={y} r={1.5} fill={color} />;
          }
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={color}
              stroke="var(--paper)"
              strokeWidth={2}
            />
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((lbl, i) => (
          <text
            key={i}
            x={lbl.x}
            y={height - 2}
            textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
            fill="var(--muted)"
            fontSize="9"
          >
            {lbl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
