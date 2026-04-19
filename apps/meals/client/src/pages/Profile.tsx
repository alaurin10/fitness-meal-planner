import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useProfile, useSaveProfile } from "../hooks/useProfile";
import type { MealProfileInput } from "../lib/types";

const EMPTY: MealProfileInput = {
  caloricTarget: null,
  proteinTargetG: null,
  dietaryNotes: null,
};

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
  const [form, setForm] = useState<MealProfileInput>(EMPTY);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (query.data) {
      setForm({
        caloricTarget: query.data.caloricTarget,
        proteinTargetG: query.data.proteinTargetG,
        dietaryNotes: query.data.dietaryNotes,
      });
    }
  }, [query.data]);

  const upd = <K extends keyof MealProfileInput>(
    k: K,
    v: MealProfileInput[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const addQuick = (note: string) => {
    const current = form.dietaryNotes ?? "";
    if (current.toLowerCase().includes(note.toLowerCase())) return;
    upd("dietaryNotes", current ? `${current}, ${note}` : note);
  };

  return (
    <Layout>
      <PhoneHeader
        title="Profile"
        subtitle="Shapes your weekly plan and grocery list."
      />

      {/* Identity */}
      <div className="px-4 pt-1">
        <Card className="flex items-center gap-3.5">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "linear-gradient(135deg, var(--moss), var(--accent))",
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
            <Icon name="leaf" size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-display"
              style={{ fontSize: 20, color: "var(--ink)" }}
            >
              Your kitchen
            </div>
            <div
              style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}
            >
              Your meal profile
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
        {/* Targets */}
        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Daily targets</div>
        </div>
        <div className="px-4 grid grid-cols-2 gap-2.5">
          <Card>
            <div
              style={{ fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}
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
          </Card>
          <Card>
            <div
              style={{ fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}
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
