import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { useCurrentPlan } from "../hooks/usePlan";

export function PlanPage() {
  const { data: plan, isLoading } = useCurrentPlan();

  return (
    <Layout title="Plan">
      {isLoading && <Card>Loading…</Card>}
      {!isLoading && !plan && (
        <Card>
          <p className="text-muted text-sm">
            No plan yet. Generate one from the home screen.
          </p>
        </Card>
      )}
      {plan && (
        <>
          <Card accent>
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Summary
            </p>
            <p className="text-sm">{plan.planJson.summary}</p>
            <p className="text-xs text-muted mt-2">
              Daily: {plan.planJson.dailyCalorieTarget} kcal
            </p>
          </Card>
          {plan.planJson.days.map((day) => {
            const dayCalories = day.meals.reduce(
              (sum, m) => sum + m.calories,
              0,
            );
            const dayProtein = day.meals.reduce(
              (sum, m) => sum + m.proteinG,
              0,
            );
            return (
              <Card key={day.day}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg">{day.day}</h2>
                  <span className="text-xs uppercase tracking-widest text-muted">
                    {dayCalories} kcal · {dayProtein}g
                  </span>
                </div>
                <ul className="space-y-3">
                  {day.meals.map((meal, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="flex justify-between">
                        <span>{meal.name}</span>
                        <span className="text-muted text-xs">
                          {meal.calories} kcal · {meal.proteinG}g
                        </span>
                      </div>
                      <p className="text-muted text-xs mt-1">
                        {meal.ingredients.map((i) => `${i.qty} ${i.name}`).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </>
      )}
    </Layout>
  );
}
