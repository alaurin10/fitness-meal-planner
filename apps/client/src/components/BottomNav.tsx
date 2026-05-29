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

export function BottomNav() {
  // Collapse to a compact, icons-only bar while scrolling down; expand back to
  // the full icon + label bar when scrolling up or at the top.
  const collapsed = useScrollDirection();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] z-20 md:hidden"
      style={{
        background: "color-mix(in srgb, var(--paper) 80%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--hair)",
        // Compact vs full vertical padding — drives the height change.
        paddingTop: collapsed ? 6 : 8,
        paddingLeft: 10,
        paddingRight: 10,
        paddingBottom: collapsed
          ? "calc(env(safe-area-inset-bottom, 16px) + 6px)"
          : "calc(env(safe-area-inset-bottom, 16px) + 10px)",
        transition: "padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <ul className="grid grid-cols-6 gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className="tappable block"
              style={({ isActive }) => ({
                background: "transparent",
                color: isActive ? "var(--accent)" : "var(--muted)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: collapsed ? 0 : 4,
                padding: collapsed ? "6px 4px" : "8px 4px",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.05em",
                position: "relative",
                transition: "gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        top: collapsed ? -6 : 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 20,
                        height: 2.5,
                        borderRadius: 99,
                        background: "var(--accent)",
                        transition: "top 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                      }}
                    />
                  )}
                  <Icon name={item.icon} size={22} stroke={isActive ? 2 : 1.6} />
                  {/* Label collapses (height + opacity) on scroll-down. */}
                  <span
                    aria-hidden
                    style={{
                      maxHeight: collapsed ? 0 : 16,
                      opacity: collapsed ? 0 : 1,
                      overflow: "hidden",
                      lineHeight: "16px",
                      transition:
                        "max-height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease",
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
