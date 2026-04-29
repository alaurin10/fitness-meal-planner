import { NavLink } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { Icon, type IconName } from "./Icon";
import { Wordmark } from "./Primitives";

const items: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/workouts", label: "Workouts", icon: "dumbbell" },
  { to: "/meals", label: "Meals", icon: "leaf" },
  { to: "/recipes", label: "Recipes", icon: "fork" },
  { to: "/groceries", label: "Groceries", icon: "groceries" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

export function SideNav() {
  return (
    <nav
      className="hidden md:flex fixed top-0 left-0 h-screen flex-col z-20"
      style={{
        width: 220,
        background: "var(--paper)",
        borderRight: "1px solid var(--hair)",
      }}
    >
      <div style={{ padding: "20px 20px 28px" }}>
        <Wordmark />
      </div>

      <ul style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {items.map((item) => (
          <li key={item.to} style={{ listStyle: "none" }}>
            <NavLink
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: isActive
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--accent)" : "var(--sumi)",
                fontSize: 14,
                fontWeight: isActive ? 500 : 400,
                textDecoration: "none",
                position: "relative",
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 20,
                        borderRadius: 99,
                        background: "var(--accent)",
                      }}
                    />
                  )}
                  <Icon name={item.icon} size={20} stroke={isActive ? 2 : 1.6} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--hair)" }}>
        <UserButton />
      </div>
    </nav>
  );
}
