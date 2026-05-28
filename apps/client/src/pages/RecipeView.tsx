import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useConfirm } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { MealDetailView } from "../components/MealDetailView";
import { SkeletonList } from "../components/Skeleton";
import {
  useDeleteRecipe,
  useRecipe,
  useUpdateRecipe,
} from "../hooks/useRecipes";
import { recipeToMeal } from "../lib/recipeAdapter";

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function RecipeViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id);
  const update = useUpdateRecipe();
  const del = useDeleteRecipe();
  const { confirm, dialog: confirmDialog } = useConfirm();

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <SkeletonList count={3} />
        </div>
      </Layout>
    );
  }

  if (!recipe) {
    return (
      <Layout>
        <div className="px-4 pt-4">
          <Button variant="ghost" onClick={() => navigate("/recipes")}>
            <Icon name="chevron" size={16} style={{ transform: "rotate(180deg)" }} />
            Back to recipes
          </Button>
          <Card style={{ marginTop: 12 }}>Recipe not found.</Card>
        </div>
      </Layout>
    );
  }

  const meal = recipeToMeal(recipe);
  const slotLabel = recipe.slotHint
    ? SLOT_LABEL[recipe.slotHint]
    : undefined;

  return (
    <Layout>
      <MealDetailView
        meal={meal}
        slotLabel={slotLabel}
        topAction={
          <div
            style={{
              padding: "8px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button
              variant="plain"
              onClick={() => navigate("/recipes")}
              style={{ paddingLeft: 0 }}
            >
              <Icon
                name="chevron"
                size={16}
                style={{ transform: "rotate(180deg)" }}
              />
              Recipe book
            </Button>
            <button
              type="button"
              onClick={() =>
                update.mutate({
                  id: recipe.id,
                  input: { isFavorite: !recipe.isFavorite },
                })
              }
              aria-label={
                recipe.isFavorite ? "Unfavorite recipe" : "Favorite recipe"
              }
              className="tappable"
              style={{
                background: "transparent",
                border: "none",
                color: recipe.isFavorite ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                padding: 6,
              }}
            >
              <Icon name="heart" size={20} />
            </button>
          </div>
        }
        bottomActions={
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
            >
              <Icon name="note" size={14} />
              Edit
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete "${recipe.name}"?`,
                  message: "This removes the recipe from your recipe book.",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (ok) {
                  del.mutate(recipe.id, {
                    onSuccess: () => navigate("/recipes"),
                  });
                }
              }}
              disabled={del.isPending}
              style={{ color: "var(--rose)" }}
            >
              <Icon name="x" size={14} />
              Delete
            </Button>
          </div>
        }
      />
      {confirmDialog}
    </Layout>
  );
}
