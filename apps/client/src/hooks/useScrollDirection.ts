import { useEffect, useState } from "react";

/**
 * Returns `true` when the user is scrolling DOWN (used to collapse the bottom
 * nav into its compact state), and `false` when scrolling up or near the top.
 *
 * - Ignores tiny jitters via `delta`.
 * - Always expands when within `topThreshold` of the top.
 * - rAF-throttled, passive window scroll listener.
 */
export function useScrollDirection(options?: {
  delta?: number;
  topThreshold?: number;
}): boolean {
  const delta = options?.delta ?? 6;
  const topThreshold = options?.topThreshold ?? 24;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (y <= topThreshold) {
        setCollapsed(false);
      } else if (Math.abs(y - lastY) >= delta) {
        setCollapsed(y > lastY);
      }
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [delta, topThreshold]);

  return collapsed;
}
