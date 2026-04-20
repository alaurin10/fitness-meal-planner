import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import {
  useProfile,
  useSaveProfile,
  type Profile,
  type ProfileInput,
} from "../hooks/useProfile";
import { computeSuggestedTargets } from "../lib/targets";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

const EMPTY: ProfileInput = {
  unitSystem: "imperial",
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
  const [useSuggestedCalories, setUseSuggestedCalories] = useState(true);
  const [useSuggestedProtein, setUseSuggestedProtein] = useState(true);
  const [toast, setToast] = useState(false);

  const liveSuggested = useMemo(
    () =>
      computeSuggestedTargets({
        sex: form.sex,
        age: form.age,
        weightLbs: form.weightLbs,
        heightIn: form.heightIn,
        trainingDaysPerWeek: form.trainingDaysPerWeek,
        goal: form.goal,
      }),
    [
      form.age,
      form.goal,
      form.heightIn,
      form.sex,
      form.trainingDaysPerWeek,
      form.weightLbs,
    ],
  );

  useEffect(() => {
    if (!query.data?.profile) return;

    const nextForm = profileToForm(query.data.profile);
    setForm(nextForm);
    setUseSuggestedCalories(
      shouldUseSuggested(query.data.profile.caloricTarget, query.data.suggested?.caloricTarget),
    );
    setUseSuggestedProtein(
      shouldUseSuggested(query.data.profile.proteinTargetG, query.data.suggested?.proteinTargetG),
    );
  }, [query.data]);

  const upd = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addQuick = (note: string) => {
    const current = form.dietaryNotes ?? "";
    if (current.toLowerCase().includes(note.toLowerCase())) return;
    upd("dietaryNotes", current ? `${current}, ${note}` : note);
  };

  const heightFeet = useMemo(() => toFeetInches(form.heightIn).feet, [form.heightIn]);
  const heightInches = useMemo(() => toFeetInches(form.heightIn).inches, [form.heightIn]);
  const displayWeight = form.weightLbs == null
    ? ""
    : form.unitSystem === "metric"
      ? roundTo(form.weightLbs * KG_PER_LB, 1)
      : roundTo(form.weightLbs, 1);
  const displayHeightCm = form.heightIn == null ? "" : roundTo(form.heightIn * CM_PER_IN, 1);

  return (
    <Layout>
      <PhoneHeader
        title="Profile"
        subtitle="Shapes your weekly plans and daily targets."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();

          const payload: ProfileInput = {
            ...form,
            caloricTarget: useSuggestedCalories ? undefined : form.caloricTarget,
            proteinTargetG: useSuggestedProtein ? undefined : form.proteinTargetG,
          };

          save.mutate(payload, {
            onSuccess: (data) => {
              setForm(profileToForm(data.profile));
              setUseSuggestedCalories(
                shouldUseSuggested(data.profile.caloricTarget, data.suggested?.caloricTarget),
              );
              setUseSuggestedProtein(
                shouldUseSuggested(data.profile.proteinTargetG, data.suggested?.proteinTargetG),
              );
              setToast(true);
              setTimeout(() => setToast(false), 1800);
            },
          });
        }}
      >
        <div className="px-6 pt-4 pb-2">
          <div className="eyebrow">Your numbers</div>
        </div>
        <div className="px-4">
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <FieldBlock label="Units">
                <div style={twoColGrid}>
                  {(["imperial", "metric"] as const).map((system) => {
                    const selected = form.unitSystem === system;
                    return (
                      <ChoiceButton
                        key={system}
                        active={selected}
                        onClick={() => upd("unitSystem", system)}
                      >
                        {system === "imperial" ? "Imperial" : "Metric"}
                      </ChoiceButton>
                    );
                  })}
                </div>
              </FieldBlock>

              <div style={twoColGrid}>
                <NumberField
                  label="Age"
                  unit="yrs"
                  value={form.age ?? ""}
                  onChange={(value) => upd("age", value)}
                  min={10}
                  max={100}
                />
                <FieldBlock label="Sex">
                  <div style={twoColGrid}>
                    {(["male", "female"] as const).map((value) => (
                      <ChoiceButton
                        key={value}
                        active={form.sex === value}
                        onClick={() => upd("sex", value)}
                        compact
                      >
                        {value}
                      </ChoiceButton>
                    ))}
                  </div>
                </FieldBlock>
              </div>

              <div style={twoColGrid}>
                <NumberField
                  label="Weight"
                  unit={form.unitSystem === "metric" ? "kg" : "lb"}
                  value={displayWeight}
                  onChange={(value) =>
                    upd(
                      "weightLbs",
                      value == null
                        ? null
                        : form.unitSystem === "metric"
                          ? roundTo(value / KG_PER_LB, 2)
                          : value,
                    )
                  }
                  step={form.unitSystem === "metric" ? 0.1 : 1}
                  min={form.unitSystem === "metric" ? 30 : 65}
                />
                {form.unitSystem === "metric" ? (
                  <NumberField
                    label="Height"
                    unit="cm"
                    value={displayHeightCm}
                    onChange={(value) =>
                      upd("heightIn", value == null ? null : roundTo(value / CM_PER_IN, 2))
                    }
                    step={0.1}
                    min={120}
                  />
                ) : (
                  <ImperialHeightField
                    feet={heightFeet}
                    inches={heightInches}
                    onFeetChange={(feet) =>
                      upd("heightIn", feet == null && heightInches == null ? null : toInches(feet, heightInches))
                    }
                    onInchesChange={(inches) =>
                      upd("heightIn", heightFeet == null && inches == null ? null : toInches(heightFeet, inches))
                    }
                  />
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Training</div>
        </div>
        <div className="px-4">
          <Card>
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabelStyle}>Experience</div>
              <div style={{ ...twoColGrid, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                {EXPERIENCE.map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={form.experienceLevel === value}
                    onClick={() => upd("experienceLevel", value)}
                    compact
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  alignItems: "center",
                }}
              >
                <span style={sectionLabelStyle}>Training days / week</span>
                <span
                  className="font-display"
                  style={{ fontSize: 18, color: "var(--accent)" }}
                >
                  {form.trainingDaysPerWeek}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => upd("trainingDaysPerWeek", n)}
                    className="tappable"
                    style={{
                      minWidth: 40,
                      padding: "10px 0",
                      border: "1px solid " + (form.trainingDaysPerWeek === n ? "var(--accent)" : "var(--hair)"),
                      background:
                        form.trainingDaysPerWeek === n
                          ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                          : "var(--paper)",
                      color: form.trainingDaysPerWeek === n ? "var(--accent-2)" : "var(--sumi)",
                      borderRadius: "calc(var(--radius) * 0.55)",
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                      flex: 1,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={sectionLabelStyle}>Goal</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {GOALS.map(([value, label, icon]) => {
                  const selected = form.goal === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => upd("goal", value)}
                      className="tappable"
                      style={{
                        padding: "15px 10px 12px",
                        border: "1px solid " + (selected ? "var(--accent)" : "var(--hair)"),
                        background: selected
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : "var(--paper)",
                        color: selected ? "var(--accent-2)" : "var(--sumi)",
                        borderRadius: "calc(var(--radius) * 0.7)",
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
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Daily targets</div>
        </div>
        <div className="px-4 space-y-2.5">
          <TargetCard
            title="Calories"
            unit="kcal"
            helper="Estimated from your body size, training days, and goal."
            value={form.caloricTarget ?? ""}
            suggestedValue={liveSuggested?.caloricTarget ?? null}
            useSuggested={useSuggestedCalories}
            onToggle={() => setUseSuggestedCalories((current) => !current)}
            onChange={(value) => upd("caloricTarget", value)}
            min={1200}
            max={6000}
          />
          <TargetCard
            title="Protein"
            unit="g"
            helper="Estimated to support recovery and your current goal."
            value={form.proteinTargetG ?? ""}
            suggestedValue={liveSuggested?.proteinTargetG ?? null}
            useSuggested={useSuggestedProtein}
            onToggle={() => setUseSuggestedProtein((current) => !current)}
            onChange={(value) => upd("proteinTargetG", value)}
            min={40}
            max={300}
          />
        </div>

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

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  children,
  compact = false,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable"
      style={{
        padding: compact ? "10px 10px" : "12px 12px",
        border: "1px solid " + (active ? "var(--ink)" : "var(--hair)"),
        background: active ? "var(--ink)" : "var(--paper)",
        color: active ? "var(--paper)" : "var(--sumi)",
        borderRadius: "calc(var(--radius) * 0.6)",
        fontFamily: "var(--font-body)",
        fontSize: compact ? 12 : 13,
        fontWeight: 500,
        textTransform: "capitalize",
      }}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number | "";
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <FieldBlock label={label}>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          inputMode="decimal"
          className="field-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={{ paddingRight: 44 }}
        />
        <span style={unitStyle}>{unit}</span>
      </div>
    </FieldBlock>
  );
}

function ImperialHeightField({
  feet,
  inches,
  onFeetChange,
  onInchesChange,
}: {
  feet: number | null;
  inches: number | null;
  onFeetChange: (value: number | null) => void;
  onInchesChange: (value: number | null) => void;
}) {
  return (
    <FieldBlock label="Height">
      <div style={twoColGrid}>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            inputMode="numeric"
            className="field-input"
            value={feet ?? ""}
            min={3}
            max={8}
            onChange={(e) => onFeetChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ paddingRight: 34 }}
          />
          <span style={unitStyle}>ft</span>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            inputMode="numeric"
            className="field-input"
            value={inches ?? ""}
            min={0}
            max={11}
            onChange={(e) =>
              onInchesChange(
                e.target.value === ""
                  ? null
                  : Math.max(0, Math.min(11, Number(e.target.value))),
              )
            }
            style={{ paddingRight: 34 }}
          />
          <span style={unitStyle}>in</span>
        </div>
      </div>
    </FieldBlock>
  );
}

function TargetCard({
  title,
  unit,
  helper,
  value,
  suggestedValue,
  useSuggested,
  onToggle,
  onChange,
  min,
  max,
}: {
  title: string;
  unit: string;
  helper: string;
  value: number | "";
  suggestedValue: number | null;
  useSuggested: boolean;
  onToggle: () => void;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
}) {
  return (
    <Card tone={useSuggested ? "gradient" : "paper"}>
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          {useSuggested ? (
            <>
              <div
                className="font-display"
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 8,
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontSize: suggestedValue == null ? 24 : 32 }}>
                  {suggestedValue ?? "Waiting on your stats"}
                </span>
                {suggestedValue != null && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{unit}</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--sumi)", marginTop: 6 }}>
                {suggestedValue == null
                  ? "Add age, sex, weight, and height for a tailored estimate."
                  : helper}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--sumi)", marginTop: 8 }}>
              Override the estimate if you already have a goal from a coach or tracker.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="tappable"
          style={{
            border: "1px solid var(--hair)",
            background: useSuggested ? "var(--paper)" : "var(--ink)",
            color: useSuggested ? "var(--sumi)" : "var(--paper)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {useSuggested ? "Customize" : "Use suggestion"}
        </button>
      </div>

      {!useSuggested && (
        <div style={{ marginTop: 14 }}>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              min={min}
              max={max}
              className="field-input font-display"
              value={value}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              placeholder={suggestedValue == null ? "" : String(suggestedValue)}
              style={{ fontSize: 24, paddingRight: 54 }}
            />
            <span style={unitStyle}>{unit}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            {suggestedValue == null
              ? "We can suggest this once the core stats above are filled in."
              : `Suggested: ${suggestedValue} ${unit}`}
          </div>
        </div>
      )}
    </Card>
  );
}

function profileToForm(profile: Profile): ProfileInput {
  return {
    unitSystem: profile.unitSystem ?? "imperial",
    age: profile.age,
    sex: profile.sex,
    weightLbs: profile.weightLbs,
    heightIn: profile.heightIn,
    experienceLevel: profile.experienceLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    goal: profile.goal,
    caloricTarget: profile.caloricTarget,
    proteinTargetG: profile.proteinTargetG,
    dietaryNotes: profile.dietaryNotes,
  };
}

function shouldUseSuggested(savedValue: number | null, suggestedValue?: number | null) {
  if (suggestedValue == null) return savedValue == null;
  return savedValue === suggestedValue;
}

function toFeetInches(heightIn: number | null) {
  if (heightIn == null) return { feet: null, inches: null };
  const rounded = Math.max(0, Math.round(heightIn));
  return {
    feet: Math.floor(rounded / 12),
    inches: rounded % 12,
  };
}

function toInches(feet: number | null, inches: number | null) {
  const safeFeet = feet ?? 0;
  const safeInches = inches ?? 0;
  return safeFeet * 12 + safeInches;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--sumi)",
  marginBottom: 8,
};

const unitStyle: CSSProperties = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 12,
  color: "var(--muted)",
  letterSpacing: "0.03em",
};
