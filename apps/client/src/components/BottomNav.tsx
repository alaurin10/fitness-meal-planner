import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const items: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/workouts", label: "Workouts", icon: "dumbbell" },
  { to: "/meals", label: "Meals", icon: "leaf" },
  { to: "/groceries", label: "Groceries", icon: "groceries" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] z-20"
      style={{
        background: "color-mix(in srgb, var(--paper) 92%, transparent)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid var(--hair)",
        padding: "8px 10px calc(env(safe-area-inset-bottom, 16px) + 10px)",
      }}
    >
      <ul className="grid grid-cols-5 gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className="tappable block"
              style={({ isActive }) => ({
                background: "transparent",
                color: isActive ? "var(--accent)" : "var(--muted)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "8px 4px",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.05em",
                position: "relative",
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 20,
                        height: 2.5,
                        borderRadius: 99,
                        background: "var(--accent)",
                      }}
                    />
                  )}
                  <Icon name={item.icon} size={22} stroke={isActive ? 2 : 1.6} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
