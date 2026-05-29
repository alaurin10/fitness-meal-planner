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

const NAV_TRANSITION =
  "width 240ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";
const ITEM_TRANSITION =
  "gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1), background 180ms ease";
const LABEL_TRANSITION =
  "max-height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease";

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
      className="fixed z-20 md:hidden"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 8px) + 4px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: collapsed
          ? "min(300px, calc(100vw - 110px))"
          : "min(400px, calc(100vw - 40px))",
        background: "color-mix(in srgb, var(--paper) 70%, transparent)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        border: "1px solid color-mix(in srgb, var(--muted) 22%, transparent)",
        borderRadius: 26,
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.14)",
        paddingTop: collapsed ? 5 : 8,
        paddingBottom: collapsed ? 5 : 8,
        paddingInline: collapsed ? 4 : 6,
        transition: animate ? NAV_TRANSITION : "none",
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
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: collapsed ? 0 : 4,
                padding: collapsed ? "6px 0" : "7px 0",
                borderRadius: 14,
                background: isActive
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
                color: isActive ? "var(--accent)" : "var(--muted)",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.04em",
                transition: animate ? ITEM_TRANSITION : "none",
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} size={22} stroke={isActive ? 2 : 1.6} />
                  <span
                    aria-hidden
                    style={{
                      maxHeight: collapsed ? 0 : 16,
                      opacity: collapsed ? 0 : 1,
                      overflow: "hidden",
                      lineHeight: "16px",
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
