import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { useProfile, useSaveProfile, type FitProfileInput } from "../hooks/useProfile";

const EMPTY: FitProfileInput = {
  age: null,
  weightLbs: null,
  heightIn: null,
  experienceLevel: "beginner",
  trainingDaysPerWeek: 3,
  goal: "build_muscle",
};

export function ProfilePage() {
  const query = useProfile();
  const save = useSaveProfile();
  const [form, setForm] = useState<FitProfileInput>(EMPTY);

  useEffect(() => {
    if (query.data) {
      setForm({
        age: query.data.age,
        weightLbs: query.data.weightLbs,
        heightIn: query.data.heightIn,
        experienceLevel: query.data.experienceLevel,
        trainingDaysPerWeek: query.data.trainingDaysPerWeek,
        goal: query.data.goal,
      });
    }
  }, [query.data]);

  const update = <K extends keyof FitProfileInput>(
    key: K,
    value: FitProfileInput[K],
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
          <NumberField
            label="Age"
            value={form.age}
            onChange={(v) => update("age", v)}
          />
          <NumberField
            label="Weight (lbs)"
            value={form.weightLbs}
            onChange={(v) => update("weightLbs", v)}
          />
          <NumberField
            label="Height (in)"
            value={form.heightIn}
            onChange={(v) => update("heightIn", v)}
          />

          <SelectField
            label="Experience level"
            value={form.experienceLevel}
            options={[
              ["beginner", "Beginner"],
              ["intermediate", "Intermediate"],
              ["advanced", "Advanced"],
            ]}
            onChange={(v) =>
              update(
                "experienceLevel",
                v as FitProfileInput["experienceLevel"],
              )
            }
          />

          <NumberField
            label="Training days per week"
            value={form.trainingDaysPerWeek}
            min={1}
            max={7}
            onChange={(v) => update("trainingDaysPerWeek", v ?? 3)}
          />

          <SelectField
            label="Goal"
            value={form.goal}
            options={[
              ["build_muscle", "Build muscle"],
              ["lose_fat", "Lose fat"],
              ["maintain", "Maintain"],
            ]}
            onChange={(v) => update("goal", v as FitProfileInput["goal"])}
          />

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

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-muted mb-1">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-muted mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text focus:border-accent focus:outline-none"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
