import { NavLink } from "react-router-dom";
import { useUser } from "@clerk/react";
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
  const { user } = useUser();
  const displayName =
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account";

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
              viewTransition
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: isActive ? "var(--wash-accent-strong)" : "transparent",
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

      <div style={{ padding: "12px 8px", borderTop: "1px solid var(--hair)" }}>
        <NavLink
          to="/profile?tab=account"
          viewTransition
          aria-label="Account"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 10,
            color: "var(--sumi)",
            fontSize: 13,
            textDecoration: "none",
          }}
          className="popmenu-item"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              width={28}
              height={28}
              style={{
                display: "block",
                borderRadius: "50%",
                border: "1px solid var(--hair)",
                flexShrink: 0,
              }}
            />
          ) : (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid var(--hair)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="profile" size={14} />
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>
        </NavLink>
      </div>
    </nav>
  );
}
