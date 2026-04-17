import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { useProfile, useSaveProfile } from "../hooks/useProfile";
import type { MealProfileInput } from "../lib/types";

const EMPTY: MealProfileInput = {
  caloricTarget: null,
  proteinTargetG: null,
  dietaryNotes: null,
};

export function ProfilePage() {
  const query = useProfile();
  const save = useSaveProfile();
  const [form, setForm] = useState<MealProfileInput>(EMPTY);

  useEffect(() => {
    if (query.data) {
      setForm({
        caloricTarget: query.data.caloricTarget,
        proteinTargetG: query.data.proteinTargetG,
        dietaryNotes: query.data.dietaryNotes,
      });
    }
  }, [query.data]);

  const update = <K extends keyof MealProfileInput>(
    key: K,
    value: MealProfileInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Layout title="Profile">
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">
              Daily calorie target
            </span>
            <input
              type="number"
              min={800}
              max={6000}
              value={form.caloricTarget ?? ""}
              onChange={(e) =>
                update(
                  "caloricTarget",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">
              Protein target (g)
            </span>
            <input
              type="number"
              min={20}
              max={500}
              value={form.proteinTargetG ?? ""}
              onChange={(e) =>
                update(
                  "proteinTargetG",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted mb-1">
              Dietary notes
            </span>
            <textarea
              rows={3}
              value={form.dietaryNotes ?? ""}
              onChange={(e) =>
                update(
                  "dietaryNotes",
                  e.target.value === "" ? null : e.target.value,
                )
              }
              placeholder="e.g. no dairy, low FODMAP, vegetarian"
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
            />
          </label>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
          {save.isSuccess && (
            <p className="text-success text-sm">Saved.</p>
          )}
        </form>
      </Card>
    </Layout>
  );
}
