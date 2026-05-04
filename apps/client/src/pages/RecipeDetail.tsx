import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { MealDetailView } from "../components/MealDetailView";
import { useCurrentMealPlan, type WeekKey } from "../hooks/useMealPlan";
import {
  localDayKey,
  useMealCompletions,
} from "../hooks/useMealCompletions";
import { useSaveMealAsRecipe } from "../hooks/useRecipes";
import type { Meal, MealDay } from "../lib/types";

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const FALLBACK_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack", "Snack"];

function inferSlotLabel(meal: Meal, idx: number) {
  if (meal.slot && SLOT_LABEL[meal.slot]) return SLOT_LABEL[meal.slot];
  return FALLBACK_SLOTS[idx] ?? "Meal";
}

export function RecipeDetailPage() {
  const params = useParams<{ day: string; index: string }>();
  const [searchParams] = useSearchParams();
  const week: WeekKey = searchParams.get("week") === "next" ? "next" : "current";
  const navigate = useNavigate();
  const { data: plan, isLoading } = useCurrentMealPlan(week);
  const save = useSaveMealAsRecipe();
  const completions = useMealCompletions(plan?.id, localDayKey());

  const day = params.day as MealDay["day"];
  const idx = Number(params.index);
  const meal = plan?.planJson.days
    .find((d) => d.day === day)
    ?.meals[idx];

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  if (!plan || !meal) {
    return (
      <Layout>
        <div className="px-4 pt-4">
          <Button variant="ghost" onClick={() => navigate(backToMealsHref(week))}>
            <Icon name="chevron" size={16} style={{ transform: "rotate(180deg)" }} />
            Back to meals
          </Button>
          <Card style={{ marginTop: 12 }}>Meal not found.</Card>
        </div>
      </Layout>
    );
  }

  const slotLabel = inferSlotLabel(meal, idx);
  const saved = save.data;

  return (
    <Layout>
      <MealDetailView
        meal={meal}
        slotLabel={slotLabel}
        isComplete={completions.isComplete(idx)}
        onToggleComplete={() => completions.toggle(idx)}
        topAction={
          <div style={{ padding: "8px 16px 0" }}>
            <Button
              variant="plain"
              onClick={() => navigate(backToMealsHref(week))}
              style={{ paddingLeft: 0 }}
            >
              <Icon
                name="chevron"
                size={16}
                style={{ transform: "rotate(180deg)" }}
              />
              {longDay(day)} · meals
            </Button>
          </div>
        }
        bottomActions={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saved ? (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate(`/recipes/${saved.id}`)}
              >
                <Icon name="check" size={16} />
                Saved · open in book
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  save.mutate({ day, index: idx, planId: plan.id })
                }
                disabled={save.isPending}
              >
                <Icon name="plus" size={16} />
                {save.isPending ? "Saving…" : "Save to recipe book"}
              </Button>
            )}
            {save.isError && (
              <p
                style={{
                  color: "var(--rose)",
                  fontSize: 12.5,
                  textAlign: "center",
                }}
              >
                {(save.error as Error).message}
              </p>
            )}
          </div>
        }
      />
    </Layout>
  );
}

function backToMealsHref(week: WeekKey): string {
  return week === "next" ? "/meals?week=next" : "/meals";
}

function longDay(d: MealDay["day"]) {
  return {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  }[d];
}
