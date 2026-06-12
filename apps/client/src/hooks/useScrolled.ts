import { useLayoutEffect, useState } from "react";

/**
 * Returns `true` once the page is scrolled past `threshold` — used for
 * "elevate the sticky header" styling, where useScrollDirection's
 * direction-based collapse logic is the wrong signal.
 *
 * Same conventions as useScrollDirection: rAF-throttled passive listener,
 * and an immediate sync before first paint (Layout remounts per route, so
 * the header must not flash flat and then elevate mid-scroll).
 */
export function useScrolled(threshold = 2): boolean {
  const [scrolled, setScrolled] = useState(false);

  useLayoutEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      setScrolled(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
