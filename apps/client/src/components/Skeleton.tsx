import type { CSSProperties } from "react";
import { Card } from "./Card";

/**
 * Shimmering placeholder block used while data loads. Replaces bare "Loading…"
 * text for a calmer, layout-stable loading experience.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--muted) 12%, transparent) 25%, color-mix(in srgb, var(--muted) 22%, transparent) 37%, color-mix(in srgb, var(--muted) 12%, transparent) 63%)",
        backgroundSize: "400% 100%",
        animation: "skeleton-shimmer 1.4s ease infinite",
        ...style,
      }}
    >
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

/** A card-shaped skeleton approximating a content row/tile. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <span className="sr-only">Loading…</span>
        <Skeleton width="55%" height={20} />
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? "70%" : "100%"} height={13} />
        ))}
      </div>
    </Card>
  );
}

/** Stack of skeleton cards for list/page-level loading states. */
export function SkeletonList({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
