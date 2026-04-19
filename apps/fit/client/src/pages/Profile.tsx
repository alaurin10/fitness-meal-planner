import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { useProfile, useSaveProfile, type FitProfileInput } from "../hooks/useProfile";

const EMPTY: FitProfileInput = {
  age: null,
  weightLbs: null,
  heightIn: null,
  experienceLevel: "beginner",
  trainingDaysPerWeek: 3,
  goal: "build_muscle",
};

const EXPERIENCE: Array<[FitProfileInput["experienceLevel"], string]> = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
];

const GOALS: Array<[FitProfileInput["goal"], string, IconName]> = [
  ["build_muscle", "Build", "dumbbell"],
  ["lose_fat", "Lean", "flame"],
  ["maintain", "Maintain", "heart"],
];

export function ProfilePage() {
  const query = useProfile();
  const save = useSaveProfile();
  const [form, setForm] = useState<FitProfileInput>(EMPTY);
  const [toast, setToast] = useState(false);

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

  const upd = <K extends keyof FitProfileInput>(k: K, v: FitProfileInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numRows: Array<{ label: string; unit: string; k: "age" | "weightLbs" | "heightIn" }> = [
    { label: "Age", unit: "yrs", k: "age" },
    { label: "Weight", unit: "lb", k: "weightLbs" },
    { label: "Height", unit: "in", k: "heightIn" },
  ];

  return (
    <Layout>
      <PhoneHeader
        title="Profile"
        subtitle="Tunes your weekly plan and calorie target."
      />

      {/* Identity */}
      <div className="px-4 pt-1">
        <Card className="flex items-center gap-3.5">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "linear-gradient(135deg, var(--accent), var(--honey))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--paper)",
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-display"
              style={{ fontSize: 20, color: "var(--ink)" }}
            >
              You
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Your training profile
            </div>
          </div>
        </Card>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form, {
            onSuccess: () => {
              setToast(true);
              setTimeout(() => setToast(false), 1800);
            },
          });
        }}
      >
        {/* Numbers */}
        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Your numbers</div>
        </div>
        <div className="px-4">
          <Card flush>
            {numRows.map((r, i) => (
              <div
                key={r.k}
                style={{
                  padding: "14px 18px",
                  borderBottom:
                    i < numRows.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13.5, color: "var(--sumi)" }}>{r.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <input
                    type="number"
                    value={form[r.k] ?? ""}
                    onChange={(e) =>
                      upd(
                        r.k,
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    style={{
                      width: 64,
                      textAlign: "right",
                      border: "none",
                      background: "transparent",
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      color: "var(--ink)",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {r.unit}
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Training */}
        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Training</div>
        </div>
        <div className="px-4">
          <Card>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, color: "var(--sumi)", marginBottom: 8 }}>
                Experience
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {EXPERIENCE.map(([v, l]) => {
                  const sel = form.experienceLevel === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => upd("experienceLevel", v)}
                      className="tappable"
                      style={{
                        flex: 1,
                        padding: "9px 6px",
                        border: "1px solid " + (sel ? "var(--ink)" : "var(--hair)"),
                        background: sel ? "var(--ink)" : "transparent",
                        color: sel ? "var(--paper)" : "var(--sumi)",
                        borderRadius: "calc(var(--radius) * 0.6)",
                        fontFamily: "var(--font-body)",
                        fontSize: 11.5,
                        fontWeight: 500,
                      }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12.5, color: "var(--sumi)" }}>
                  Training days / week
                </span>
                <span
                  className="font-display"
                  style={{ fontSize: 16, color: "var(--accent)" }}
                >
                  {form.trainingDaysPerWeek}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const on = form.trainingDaysPerWeek >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => upd("trainingDaysPerWeek", n)}
                      className="tappable"
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        border:
                          "1px solid " + (on ? "var(--accent)" : "var(--hair)"),
                        background: on
                          ? "color-mix(in srgb, var(--accent) 20%, transparent)"
                          : "transparent",
                        color: on ? "var(--accent-2)" : "var(--muted)",
                        borderRadius: "calc(var(--radius) * 0.5)",
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, color: "var(--sumi)", marginBottom: 8 }}>
                Goal
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                }}
              >
                {GOALS.map(([v, l, icon]) => {
                  const sel = form.goal === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => upd("goal", v)}
                      className="tappable"
                      style={{
                        padding: "14px 8px 10px",
                        border:
                          "1px solid " + (sel ? "var(--accent)" : "var(--hair)"),
                        background: sel
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "transparent",
                        color: sel ? "var(--accent-2)" : "var(--sumi)",
                        borderRadius: "calc(var(--radius) * 0.6)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <Icon name={icon} size={18} />
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="px-4 pt-5">
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
          {toast && (
            <div
              className="fade-up"
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--moss)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={14} /> Saved.
            </div>
          )}
        </div>
      </form>
    </Layout>
  );
}
