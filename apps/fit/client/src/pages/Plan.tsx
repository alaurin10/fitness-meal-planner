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
          </Card>
          {plan.planJson.days.map((day) => (
            <Card key={day.day}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg">{day.day}</h2>
                <span className="text-xs uppercase tracking-widest text-muted">
                  {day.focus}
                </span>
              </div>
              <ul className="space-y-2">
                {day.exercises.map((ex, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="text-text">{ex.name}</p>
                      {ex.notes && (
                        <p className="text-muted text-xs mt-0.5">{ex.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-muted shrink-0">
                      <div>
                        {ex.sets} × {ex.reps}
                      </div>
                      <div className="text-xs">
                        {ex.loadLbs !== null ? `${ex.loadLbs} lb` : "BW"}
                        {" · "}
                        {ex.restSeconds}s
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </Layout>
  );
}
