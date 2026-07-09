import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const items: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/workouts", label: "Workouts", icon: "dumbbell" },
  { to: "/meals", label: "Meals", icon: "leaf" },
  { to: "/recipes", label: "Recipes", icon: "fork" },
  { to: "/groceries", label: "Groceries", icon: "groceries" },
  { to: "/progress", label: "Progress", icon: "progress" },
];

/**
 * Floating pill nav, fixed to the bottom. The active tab expands into a
 * solid accent pill with its label beside the icon; the rest stay
 * icon-only. The bar keeps one constant size — no scroll-reactive
 * resizing — and an opaque surface (.bar-solid) rather than glass:
 * backdrop-filter on a fixed element makes iOS Safari occasionally
 * detach it and let it drift during momentum scrolling.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed z-20 md:hidden bar-solid"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 8px) + 4px)",
        // Centered via auto margins rather than translateX(-50%): a transform
        // on a fixed element is another trigger for the same iOS drift.
        left: 0,
        right: 0,
        marginInline: "auto",
        width: "fit-content",
        maxWidth: "calc(100vw - 24px)",
        borderRadius: 999,
        padding: 6,
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
                padding: isActive ? "10px 14px" : "10px 11px",
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
                    <Icon name={item.icon} size={22} stroke={isActive ? 2 : 1.6} />
                  </span>
                  {/* Label rides inside the active pill only */}
                  <span
                    aria-hidden
                    style={{
                      maxWidth: isActive ? 92 : 0,
                      opacity: isActive ? 1 : 0,
                      marginLeft: isActive ? 7 : 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
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
