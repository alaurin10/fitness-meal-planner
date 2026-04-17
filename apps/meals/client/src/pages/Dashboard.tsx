import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { useCurrentPlan, useGeneratePlan } from "../hooks/usePlan";
import { useProfile } from "../hooks/useProfile";

export function DashboardPage() {
  const profileQuery = useProfile();
  const planQuery = useCurrentPlan();
  const generate = useGeneratePlan();

  if (profileQuery.isLoading || planQuery.isLoading) {
    return (
      <Layout title="Meals">
        <Card>Loading…</Card>
      </Layout>
    );
  }

  const profile = profileQuery.data;
  const plan = planQuery.data;

  if (!profile) {
    return (
      <Layout title="Meals">
        <Card accent>
          <h2 className="text-lg mb-2">Welcome</h2>
          <p className="text-muted mb-4 text-sm">
            Set up your profile (calories, protein target, dietary notes) to generate your first week.
          </p>
          <Link to="/profile">
            <Button>Set up profile</Button>
          </Link>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="Meals">
      {plan ? (
        <>
          <Card accent>
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              This week
            </p>
            <p className="text-sm">{plan.planJson.summary}</p>
            <p className="text-xs text-muted mt-2">
              Daily target: {plan.planJson.dailyCalorieTarget} kcal
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/plan">
              <Button variant="secondary" className="w-full">
                View plan
              </Button>
            </Link>
            <Link to="/groceries">
              <Button className="w-full">Groceries</Button>
            </Link>
          </div>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "Regenerating…" : "Regenerate plan"}
          </Button>
          {generate.isError && (
            <Card className="border-danger text-danger text-sm">
              {(generate.error as Error).message}
            </Card>
          )}
        </>
      ) : (
        <Card accent>
          <h2 className="text-lg mb-2">No active plan</h2>
          <p className="text-muted mb-4 text-sm">
            Generate a weekly meal plan. It pulls your workout schedule from the fitness app to tune your daily calorie target.
          </p>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "Generating…" : "Generate plan"}
          </Button>
          {generate.isError && (
            <p className="text-danger text-sm mt-3">
              {(generate.error as Error).message}
            </p>
          )}
        </Card>
      )}
    </Layout>
  );
}
