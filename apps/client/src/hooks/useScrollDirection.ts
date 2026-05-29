import { useEffect, useState } from "react";

/**
 * Returns `true` when the bottom nav should be in its compact state.
 *
 * - Compact while scrolling DOWN past a small `delta`; full while scrolling up.
 * - Always full within `topThreshold` of the very top.
 * - Stays compact at the bottom of the page, and ignores iOS rubber-band
 *   overscroll (scrollY is clamped to the real range) so the bounce-back at the
 *   end doesn't flip the bar open.
 * - rAF-throttled, passive window scroll listener.
 */
export function useScrollDirection(options?: {
  delta?: number;
  topThreshold?: number;
  bottomThreshold?: number;
}): boolean {
  const delta = options?.delta ?? 6;
  const topThreshold = options?.topThreshold ?? 24;
  const bottomThreshold = options?.bottomThreshold ?? 8;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lastY = clampScrollY();
    let ticking = false;

    function clampScrollY() {
      const max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      // Clamp away the negative / beyond-max values iOS reports during the
      // rubber-band bounce.
      return Math.min(Math.max(window.scrollY, 0), max);
    }

    const update = () => {
      ticking = false;
      const max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const y = Math.min(Math.max(window.scrollY, 0), max);

      if (y <= topThreshold) {
        setCollapsed(false);
      } else if (y >= max - bottomThreshold) {
        // At (or bouncing against) the bottom: stay compact.
        setCollapsed(true);
      } else if (y - lastY >= delta) {
        setCollapsed(true); // scrolling down
      } else if (lastY - y >= delta) {
        setCollapsed(false); // scrolling up
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
  }, [delta, topThreshold, bottomThreshold]);

  return collapsed;
}
