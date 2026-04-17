import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home" },
  { to: "/plan", label: "Plan" },
  { to: "/progress", label: "Progress" },
  { to: "/profile", label: "Profile" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] bg-surface border-t border-border">
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block text-center py-3 text-xs uppercase tracking-widest ${
                  isActive ? "text-accent" : "text-muted"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
