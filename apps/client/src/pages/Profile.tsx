import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import {
  useProfile,
  useSaveProfile,
  type ProfileInput,
  type SuggestedTargets,
} from "../hooks/useProfile";

const EMPTY: ProfileInput = {
  age: null,
  sex: null,
  weightLbs: null,
  heightIn: null,
  experienceLevel: "beginner",
  trainingDaysPerWeek: 3,
  goal: "build_muscle",
  caloricTarget: null,
  proteinTargetG: null,
  dietaryNotes: null,
};

const EXPERIENCE: Array<[ProfileInput["experienceLevel"], string]> = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
];

const GOALS: Array<[ProfileInput["goal"], string, IconName]> = [
  ["build_muscle", "Build", "dumbbell"],
  ["lose_fat", "Lean", "flame"],
  ["maintain", "Maintain", "heart"],
];

const QUICK_NOTES = [
  "Vegetarian",
  "No dairy",
  "Gluten-free",
  "Low FODMAP",
  "No pork",
  "Pescatarian",
];

export function ProfilePage() {
  const query = useProfile();
  const save = useSaveProfile();
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [suggested, setSuggested] = useState<SuggestedTargets | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (query.data?.profile) {
      const p = query.data.profile;
      setForm({
        age: p.age,
        sex: p.sex,
        weightLbs: p.weightLbs,
        heightIn: p.heightIn,
        experienceLevel: p.experienceLevel,
        trainingDaysPerWeek: p.trainingDaysPerWeek,
        goal: p.goal,
        caloricTarget: p.caloricTarget,
        proteinTargetG: p.proteinTargetG,
        dietaryNotes: p.dietaryNotes,
      });
    }
    if (query.data?.suggested) setSuggested(query.data.suggested);
  }, [query.data]);

  const upd = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addQuick = (note: string) => {
    const current = form.dietaryNotes ?? "";
    if (current.toLowerCase().includes(note.toLowerCase())) return;
    upd("dietaryNotes", current ? `${current}, ${note}` : note);
  };

  const numRows: Array<{ label: string; unit: string; k: "age" | "weightLbs" | "heightIn" }> = [
    { label: "Age", unit: "yrs", k: "age" },
    { label: "Weight", unit: "lb", k: "weightLbs" },
    { label: "Height", unit: "in", k: "heightIn" },
  ];

  return (
    <Layout>
      <PhoneHeader
        title="Profile"
        subtitle="Shapes your weekly plans and daily targets."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form, {
            onSuccess: (data) => {
              setSuggested(data.suggested);
              setToast(true);
              setTimeout(() => setToast(false), 1800);
            },
          });
        }}
      >
        {/* Numbers */}
        <div className="px-6 pt-4 pb-2">
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
            <div
              style={{
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13.5, color: "var(--sumi)" }}>Sex</span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["male", "female"] as const).map((v) => {
                  const sel = form.sex === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => upd("sex", v)}
                      className="tappable"
                      style={{
                        padding: "7px 14px",
                        border: "1px solid " + (sel ? "var(--ink)" : "var(--hair)"),
                        background: sel ? "var(--ink)" : "transparent",
                        color: sel ? "var(--paper)" : "var(--sumi)",
                        borderRadius: "calc(var(--radius) * 0.6)",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
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

        {/* Daily targets */}
        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Daily targets</div>
        </div>
        <div className="px-4 grid grid-cols-2 gap-2.5">
          <Card>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Calories
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                marginTop: 8,
              }}
            >
              <input
                type="number"
                min={800}
                max={6000}
                value={form.caloricTarget ?? ""}
                onChange={(e) =>
                  upd(
                    "caloricTarget",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="—"
                className="font-display"
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  fontSize: 26,
                  color: "var(--ink)",
                  outline: "none",
                  padding: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}
              >
                kcal
              </span>
            </div>
            {suggested && (
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>
                Suggested: {suggested.caloricTarget}kcal
              </div>
            )}
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Protein
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                marginTop: 8,
              }}
            >
              <input
                type="number"
                min={20}
                max={500}
                value={form.proteinTargetG ?? ""}
                onChange={(e) =>
                  upd(
                    "proteinTargetG",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="—"
                className="font-display"
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  fontSize: 26,
                  color: "var(--ink)",
                  outline: "none",
                  padding: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}
              >
                g
              </span>
            </div>
            {suggested && (
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>
                Suggested: {suggested.proteinTargetG}g
              </div>
            )}
          </Card>
        </div>

        {/* Dietary notes */}
        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Dietary notes</div>
        </div>
        <div className="px-4">
          <Card>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_NOTES.map((note) => {
                const active = (form.dietaryNotes ?? "")
                  .toLowerCase()
                  .includes(note.toLowerCase());
                return (
                  <button
                    key={note}
                    type="button"
                    onClick={() => addQuick(note)}
                    className="tappable"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                    disabled={active}
                  >
                    <Chip variant={active ? "moss" : "ghost"}>{note}</Chip>
                  </button>
                );
              })}
            </div>
            <textarea
              rows={3}
              value={form.dietaryNotes ?? ""}
              onChange={(e) =>
                upd(
                  "dietaryNotes",
                  e.target.value === "" ? null : e.target.value,
                )
              }
              placeholder="e.g. no dairy, low FODMAP, vegetarian"
              className="field-input"
              style={{
                resize: "vertical",
                minHeight: 80,
                fontFamily: "var(--font-body)",
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            />
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
