import type { ReactNode } from "react";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";
import { Illustration, type IllustrationName } from "./Illustration";

/**
 * Shared "nothing here yet" card with a primary call to action.
 * Used for missing plans/lists across Meals, Workouts, Groceries, Recipes.
 * Prefer `illustration` (scene art, centered) over the smaller `icon` badge.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  body,
  children,
}: {
  icon?: IconName;
  illustration?: IllustrationName;
  title: string;
  body?: string;
  /** Action buttons / error states rendered below the copy. */
  children?: ReactNode;
}) {
  const centered = illustration != null;
  return (
    <Card tone="gradient" style={centered ? { textAlign: "center" } : undefined}>
      {illustration ? (
        <Illustration
          name={illustration}
          size={150}
          className="fade-up"
          style={{ margin: "4px auto 0" }}
        />
      ) : icon ? (
        <span aria-hidden className="icon-badge">
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <div
        className="title-lg"
        style={{ marginTop: illustration ? 10 : icon ? 12 : 4 }}
      >
        {title}
      </div>
      {body && (
        <p
          className="text-body"
          style={{
            marginTop: 6,
            ...(centered ? { maxWidth: 300, marginInline: "auto" } : null),
          }}
        >
          {body}
        </p>
      )}
      {children}
    </Card>
  );
}
