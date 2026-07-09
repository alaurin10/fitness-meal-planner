import { Card } from "./Card";
import { Chip } from "./Primitives";
import { Icon } from "./Icon";
import { Illustration, mealIllustration } from "./Illustration";
import type { RecipeRecord } from "../lib/types";
import { formatMinutes } from "../lib/units";

export function RecipeCard({
  recipe,
  onSelect,
}: {
  recipe: RecipeRecord;
  onSelect: () => void;
}) {
  const total =
    recipe.totalMinutes ??
    ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || null);
  return (
    <Card
      flush
      interactive
      className="flex"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Slot art stands in for a photo — cookbook-index feel */}
      <div
        aria-hidden
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 76,
          flexShrink: 0,
          background: "var(--wash-accent)",
        }}
      >
        <Illustration name={mealIllustration(recipe.slotHint)} size={64} />
      </div>
      <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
        <div className="eyebrow">
          {recipe.source === "AI" ? "From plan" : "Manual"} ·{" "}
          {recipe.calories} kcal
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 16,
            color: "var(--ink)",
            marginTop: 4,
            lineHeight: 1.2,
          }}
        >
          {recipe.name}
        </div>
        <div
          className="flex"
          style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}
        >
          <Chip variant="moss">{recipe.proteinG}g protein</Chip>
          {total ? (
            <Chip variant="ghost">
              <Icon name="timer" size={11} /> {formatMinutes(total)}
            </Chip>
          ) : null}
          {recipe.tags.slice(0, 2).map((t) => (
            <Chip key={t} variant="ghost">
              {t}
            </Chip>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingRight: 12,
          color: recipe.isFavorite ? "var(--accent)" : "var(--muted)",
        }}
        aria-label={recipe.isFavorite ? "Favorite" : undefined}
      >
        {recipe.isFavorite ? (
          <Icon name="heart" size={16} />
        ) : (
          <Icon name="chevron" size={16} />
        )}
      </div>
    </Card>
  );
}
