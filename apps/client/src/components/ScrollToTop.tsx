import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Resets the window to the top on forward navigations (tab taps, links) while
 * leaving the browser's restored position alone on Back/Forward (POP).
 *
 * Without this, switching tabs keeps the previous page's scroll offset, so the
 * new page opens scrolled partway down and the bottom nav is stuck in its
 * compact state. Mounted high in the tree so it persists across route changes.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    // Honour the browser's saved scroll position when navigating history.
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
