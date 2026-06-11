import type { ReactNode } from "react";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";

/**
 * Shared "nothing here yet" card with a primary call to action.
 * Used for missing plans/lists across Meals, Workouts, Groceries, Recipes.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  /** Action buttons / error states rendered below the copy. */
  children?: ReactNode;
}) {
  return (
    <Card tone="gradient">
      {icon && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: 44,
            height: 44,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            color: "var(--accent)",
          }}
        >
          <Icon name={icon} size={22} />
        </span>
      )}
      <div
        className="font-display"
        style={{
          fontSize: 24,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
          marginTop: icon ? 12 : 4,
        }}
      >
        {title}
      </div>
      {body && (
        <p style={{ fontSize: 12.5, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {children}
    </Card>
  );
}
