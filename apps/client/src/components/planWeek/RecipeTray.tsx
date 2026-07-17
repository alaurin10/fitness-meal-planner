import { useDraggable } from "@dnd-kit/core";
import { Card } from "../Card";
import { RecipeBrowser } from "../RecipeBrowser";
import { RecipeCard } from "../RecipeCard";
import type { MealSlot, RecipeListItem } from "../../lib/types";

function DraggableRecipeCard({
  recipe,
  onSelect,
}: {
  recipe: RecipeListItem;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe:${recipe.id}`,
    data: { recipe },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: "grab", touchAction: "none" }}
    >
      <RecipeCard recipe={recipe} onSelect={onSelect} />
    </div>
  );
}

/**
 * Persistent desktop side panel: the recipe book as a drag source. Dropping
 * a card on a grid cell assigns it directly (see PlanWeek's onDragEnd);
 * tapping a card still works too, via the `onPick` passthrough, for anyone
 * who'd rather click than drag.
 */
export function RecipeTray({
  slot,
  onPick,
}: {
  slot?: MealSlot;
  onPick: (recipe: RecipeListItem) => void;
}) {
  return (
    <Card
      flush
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
    >
      <div style={{ padding: "14px 16px 4px" }}>
        <div className="eyebrow">Recipe book</div>
        <div className="text-caption" style={{ marginTop: 2 }}>
          Drag a recipe onto a slot, or tap it to assign to the last cell you tapped.
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 16px 12px" }}>
        <RecipeBrowser
          slot={slot}
          onPick={onPick}
          renderCard={(r) => <DraggableRecipeCard key={r.id} recipe={r} onSelect={() => onPick(r)} />}
        />
      </div>
    </Card>
  );
}
