import { useLayoutEffect, useState } from "react";

/**
 * Returns `true` when the bottom nav should be in its compact state.
 *
 * - Compact while scrolling DOWN past a small `delta`; full while scrolling up.
 * - Always full within `topThreshold` of the very top.
 * - Stays compact at the bottom of the page, and ignores iOS rubber-band
 *   overscroll (scrollY is clamped to the real range) so the bounce-back at the
 *   end doesn't flip the bar open.
 * - Syncs the correct state from the real scroll position *before the first
 *   paint* (the bar remounts on every route change, so it must not flash its
 *   default state and then jump to match the carried-over scroll offset).
 * - rAF-throttled, passive window scroll + resize listener.
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

  // useLayoutEffect (not useEffect) so the initial sync below runs before the
  // browser paints — the bar appears directly in the state that matches the
  // current scroll offset instead of rendering its default and then animating.
  useLayoutEffect(() => {
    const maxScroll = () =>
      Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );

    // Clamp away the negative / beyond-max values iOS reports during the
    // rubber-band bounce.
    const clampScrollY = () =>
      Math.min(Math.max(window.scrollY, 0), maxScroll());

    let lastY = clampScrollY();
    let ticking = false;

    const update = () => {
      ticking = false;
      const max = maxScroll();
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

    // Sync immediately so the bar mounts in the correct state instead of
    // waiting for the first scroll event.
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    // Layout changes (lazy chunks loading, viewport resize) move the scroll
    // bounds; re-evaluate so we don't get stuck in a stale state.
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [delta, topThreshold, bottomThreshold]);

  return collapsed;
}
