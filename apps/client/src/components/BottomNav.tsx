import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { useScrollDirection } from "../hooks/useScrollDirection";

const items: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/workouts", label: "Workouts", icon: "dumbbell" },
  { to: "/meals", label: "Meals", icon: "leaf" },
  { to: "/recipes", label: "Recipes", icon: "fork" },
  { to: "/groceries", label: "Groceries", icon: "groceries" },
  { to: "/progress", label: "Progress", icon: "progress" },
];

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const NAV_TRANSITION = `padding 240ms ${EASE}`;
const ITEM_TRANSITION = `background 220ms ${EASE}, padding 220ms ${EASE}, color 180ms ease`;
const LABEL_TRANSITION = `max-width 240ms ${EASE}, opacity 160ms ease, margin 240ms ${EASE}`;

/**
 * Floating glass pill nav. The active tab expands into a solid accent
 * pill with its label beside the icon; the rest stay icon-only. On
 * scroll-down the whole bar compacts and labels tuck away.
 *
 * Positioned sticky-in-flow (last child of the shell) rather than fixed:
 * backdrop-filter on a fixed element makes iOS Safari occasionally detach
 * it and let it drift during momentum scrolling, while sticky glass is
 * unaffected (see the header and the sticky action bars). Transforms on
 * the bar stay banned for the same reason — center with auto margins.
 */
export function BottomNav() {
  const collapsed = useScrollDirection();
  // The bar remounts on every route change. Animations are held off until the
  // initial collapsed state has settled (including the scroll-to-top jump on a
  // tab switch), so it snaps straight to its final size instead of animating a
  // "bounce" from the default state. Subsequent scroll changes animate normally.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="sticky z-20 md:hidden glass"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 8px) + 4px)",
        // When pinned, sticky lifts the bar ~12px above its static slot at
        // full scroll; the top margin keeps it from overlapping the content
        // right above it there.
        marginTop: 16,
        marginInline: "auto",
        width: "fit-content",
        maxWidth: "calc(100vw - 24px)",
        borderRadius: 999,
        padding: collapsed ? 4 : 6,
        transition: animate ? NAV_TRANSITION : "none",
      }}
    >
      <ul style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {items.map((item) => (
          <li key={item.to} style={{ listStyle: "none" }}>
            <NavLink
              to={item.to}
              end={item.end}
              viewTransition
              aria-label={item.label}
              className="tappable"
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
                padding: collapsed ? "8px 9px" : isActive ? "10px 14px" : "10px 11px",
                borderRadius: 999,
                background: isActive
                  ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--honey)))"
                  : "transparent",
                color: isActive ? "var(--on-accent)" : "var(--muted)",
                boxShadow: isActive
                  ? "0 3px 10px color-mix(in srgb, var(--accent) 35%, transparent)"
                  : "none",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.01em",
                textDecoration: "none",
                transition: animate ? ITEM_TRANSITION : "none",
              })}
            >
              {({ isActive }) => (
                <>
                  {/* The bar remounts per route change, so the pop replays
                      exactly once each time a tab becomes active. */}
                  <span
                    className={isActive ? "nav-icon-pop" : undefined}
                    style={{ display: "inline-flex", flexShrink: 0 }}
                  >
                    <Icon
                      name={item.icon}
                      size={collapsed ? 20 : 22}
                      stroke={isActive ? 2 : 1.6}
                    />
                  </span>
                  {/* Label rides inside the active pill only */}
                  <span
                    aria-hidden
                    style={{
                      maxWidth: isActive && !collapsed ? 92 : 0,
                      opacity: isActive && !collapsed ? 1 : 0,
                      marginLeft: isActive && !collapsed ? 7 : 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      transition: animate ? LABEL_TRANSITION : "none",
                    }}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
