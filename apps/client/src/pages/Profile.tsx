import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon, type IconName } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import {
  useProfile,
  useSaveProfile,
  EQUIPMENT_OPTIONS,
  type EquipmentId,
  type MealComplexity,
  type Profile,
  type ProfileInput,
} from "../hooks/useProfile";
import { useSettings } from "../hooks/useSettings";
import { computeSuggestedTargets } from "../lib/targets";
import {
  cmToInches,
  inchesToCm,
  kgToPounds,
  poundsToKg,
  roundTo,
  type UnitSystem,
} from "../lib/units";

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
  mealComplexity: "varied",
  equipment: [],
};

const MEAL_COMPLEXITY: Array<{
  value: MealComplexity;
  label: string;
  hint: string;
  icon: IconName;
}> = [
  {
    value: "varied",
    label: "Creative",
    hint: "Different recipes most days. Lean into variety.",
    icon: "sparkle",
  },
  {
    value: "simple",
    label: "Simple",
    hint: "Quick weeknight meals with short ingredient lists.",
    icon: "leaf",
  },
  {
    value: "prep",
    label: "Meal prep",
    hint: "Reuse a few recipes across the week. Cook in batches.",
    icon: "flame",
  },
];

const MEAL_COMPLEXITY_LABEL: Record<MealComplexity, string> = {
  varied: "Creative",
  simple: "Simple",
  prep: "Meal prep",
};

const EQUIPMENT: Array<{ value: EquipmentId; label: string }> = [
  { value: "barbell", label: "Barbell + plates" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "kettlebells", label: "Kettlebells" },
  { value: "pull_up_bar", label: "Pull-up bar" },
  { value: "bench", label: "Bench" },
  { value: "squat_rack", label: "Squat rack" },
  { value: "cable_machine", label: "Cable machine" },
  { value: "resistance_bands", label: "Resistance bands" },
  { value: "cardio_machine", label: "Cardio machine" },
];

const EQUIPMENT_LABEL: Record<EquipmentId, string> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.value, e.label]),
) as Record<EquipmentId, string>;

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

const GOAL_LABEL: Record<ProfileInput["goal"], string> = {
  build_muscle: "Build muscle",
  lose_fat: "Lean out",
  maintain: "Maintain",
};

const GOAL_ICON: Record<ProfileInput["goal"], IconName> = {
  build_muscle: "dumbbell",
  lose_fat: "flame",
  maintain: "heart",
};

const EXPERIENCE_LABEL: Record<ProfileInput["experienceLevel"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
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
  const settingsQuery = useSettings();
  const save = useSaveProfile();
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [useSuggestedCalories, setUseSuggestedCalories] = useState(true);
  const [useSuggestedProtein, setUseSuggestedProtein] = useState(true);
  const [toast, setToast] = useState(false);
  // Edit mode is only true when the user explicitly opts in, or when there's no
  // saved profile yet (first-time setup). Once query loads we flip this based
  // on whether a profile exists.
  const [isEditing, setIsEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
    if (query.isLoading) return;

    if (query.data?.profile) {
      const nextForm = profileToForm(query.data.profile);
      setForm(nextForm);
      setUseSuggestedCalories(
        shouldUseSuggested(query.data.profile.caloricTarget, query.data.suggested?.caloricTarget),
      );
      setUseSuggestedProtein(
        shouldUseSuggested(query.data.profile.proteinTargetG, query.data.suggested?.proteinTargetG),
      );
      // On first load with a saved profile, default to read-only view.
      if (!hydrated) {
        setIsEditing(!isProfileComplete(query.data.profile));
        setHydrated(true);
      }
    } else if (!hydrated) {
      // No saved profile — drop the user straight into setup.
      setIsEditing(true);
      setHydrated(true);
    }
  }, [query.isLoading, query.data, hydrated]);

  useEffect(() => {
    if (!settingsQuery.data?.unitSystem) return;
    setForm((current) => ({ ...current, unitSystem: settingsQuery.data?.unitSystem ?? "imperial" }));
  }, [settingsQuery.data?.unitSystem]);

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
      ? roundTo(poundsToKg(form.weightLbs), 1)
      : roundTo(form.weightLbs, 1);
  const displayHeightCm = form.heightIn == null ? "" : roundTo(inchesToCm(form.heightIn), 1);

  const headerRight = (
    <Link to="/settings" aria-label="Settings" className="tappable">
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "1px solid var(--hair)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--sumi)",
        }}
      >
        <Icon name="settings" size={18} />
      </span>
    </Link>
  );

  // Read-only summary view — shown once a profile is saved and the user isn't
  // actively editing. Weight logged from the Progress page still updates the
  // profile on the server, so this view stays in sync via the cache.
  if (!isEditing && query.data?.profile) {
    const p = query.data.profile;
    const suggested = query.data.suggested;
    const unitSystem: UnitSystem = p.unitSystem ?? form.unitSystem ?? "imperial";
    const caloriesAreSuggested = shouldUseSuggested(p.caloricTarget, suggested?.caloricTarget);
    const proteinIsSuggested = shouldUseSuggested(p.proteinTargetG, suggested?.proteinTargetG);

    return (
      <Layout>
        <PhoneHeader
          title="Profile"
          subtitle="Shapes your weekly plans and daily targets."
          right={headerRight}
        />

        <div className="md:grid md:grid-cols-2 md:gap-4 md:px-4">
        <div>
        <div className="px-6 pt-4 pb-2 md:px-0">
          <div className="eyebrow">Your numbers</div>
        </div>
        <div className="px-4 md:px-0">
          <Card>
            <SummaryRow label="Age" value={p.age != null ? `${p.age} yrs` : "—"} />
            <SummaryRow
              label="Sex"
              value={p.sex ? capitalize(p.sex) : "—"}
            />
            <SummaryRow
              label="Weight"
              value={formatWeightDisplay(p.weightLbs, unitSystem)}
            />
            <SummaryRow
              label="Height"
              value={formatHeightDisplay(p.heightIn, unitSystem)}
              last
            />
          </Card>
        </div>
        </div>

        <div>
        <div className="px-6 pt-5 pb-2 md:px-0 md:pt-4">
          <div className="eyebrow">Training</div>
        </div>
        <div className="px-4 md:px-0">
          <Card>
            <SummaryRow label="Experience" value={EXPERIENCE_LABEL[p.experienceLevel]} />
            <SummaryRow
              label="Training days / week"
              value={String(p.trainingDaysPerWeek)}
            />
            <SummaryRow
              label="Goal"
              value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name={GOAL_ICON[p.goal]} size={14} />
                  {GOAL_LABEL[p.goal]}
                </span>
              }
              last
            />
          </Card>
        </div>
        </div>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Daily targets</div>
        </div>
        <div className="px-4 space-y-2.5">
          <TargetSummaryCard
            title="Calories"
            unit="kcal"
            value={p.caloricTarget}
            isSuggested={caloriesAreSuggested}
          />
          <TargetSummaryCard
            title="Protein"
            unit="g"
            value={p.proteinTargetG}
            isSuggested={proteinIsSuggested}
          />
        </div>

        <div className="md:grid md:grid-cols-2 md:gap-4 md:px-4">
        <div>
        <div className="px-6 pt-5 pb-2 md:px-0">
          <div className="eyebrow">Meal style</div>
        </div>
        <div className="px-4 md:px-0">
          <Card>
            <SummaryRow
              label="Plan style"
              value={MEAL_COMPLEXITY_LABEL[p.mealComplexity ?? "varied"]}
              last
            />
          </Card>
        </div>
        </div>

        <div>
        <div className="px-6 pt-5 pb-2 md:px-0 md:pt-5">
          <div className="eyebrow">Equipment</div>
        </div>
        <div className="px-4 md:px-0">
          <Card>
            {p.equipment && p.equipment.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {p.equipment.map((id) => (
                  <Chip key={id} variant="moss">
                    {EQUIPMENT_LABEL[id] ?? id}
                  </Chip>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: "var(--sumi)" }}>
                Bodyweight only
              </div>
            )}
          </Card>
        </div>
        </div>
        </div>

        {p.dietaryNotes && p.dietaryNotes.trim() !== "" && (
          <>
            <div className="px-6 pt-5 pb-2">
              <div className="eyebrow">Dietary notes</div>
            </div>
            <div className="px-4">
              <Card>
                <div style={{ fontSize: 13.5, color: "var(--sumi)", lineHeight: 1.5 }}>
                  {p.dietaryNotes}
                </div>
              </Card>
            </div>
          </>
        )}

        <div className="px-4 pt-5">
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            onClick={() => setIsEditing(true)}
          >
            Edit profile
          </Button>
          <div
            style={{
              marginTop: 10,
              fontSize: 11.5,
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            Weight updates automatically when you log it on the Progress page.
          </div>
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
      </Layout>
    );
  }

  // Edit / first-time-setup form.
  const hasSavedProfile = Boolean(query.data?.profile);

  return (
    <Layout>
      <PhoneHeader
        title="Profile"
        subtitle={
          hasSavedProfile
            ? "Update the details that shape your plans and targets."
            : "A one-time setup to tailor your plans and targets."
        }
        right={headerRight}
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
              setIsEditing(false);
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
                          ? roundTo(kgToPounds(value), 2)
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
                      upd("heightIn", value == null ? null : roundTo(cmToInches(value), 2))
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
          <div className="eyebrow">Meal style</div>
        </div>
        <div className="px-4">
          <Card>
            <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>
              How should plans look?
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {MEAL_COMPLEXITY.map((opt) => {
                const selected = form.mealComplexity === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => upd("mealComplexity", opt.value)}
                    className="tappable"
                    style={{
                      padding: "14px 10px 12px",
                      border:
                        "1px solid " +
                        (selected ? "var(--accent)" : "var(--hair)"),
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
                    <Icon name={opt.icon} size={18} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              {MEAL_COMPLEXITY.find((o) => o.value === form.mealComplexity)?.hint}
            </div>
          </Card>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="eyebrow">Equipment</div>
        </div>
        <div className="px-4">
          <Card>
            <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>
              What can you train with?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map((opt) => {
                const active = form.equipment.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      upd(
                        "equipment",
                        active
                          ? form.equipment.filter((e) => e !== opt.value)
                          : [...form.equipment, opt.value],
                      )
                    }
                    className="tappable"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <Chip variant={active ? "moss" : "ghost"}>
                      {active ? "✓ " : ""}
                      {opt.label}
                    </Chip>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              {form.equipment.length === 0
                ? "Nothing selected — plans will be bodyweight only."
                : "Workouts will only use the equipment you've selected."}
            </div>
          </Card>
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
            {save.isPending ? "Saving…" : hasSavedProfile ? "Save changes" : "Save profile"}
          </Button>
          {hasSavedProfile && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              style={{ marginTop: 8 }}
              disabled={save.isPending}
              onClick={() => {
                // Revert form state to the last saved values and exit edit mode.
                if (query.data?.profile) {
                  setForm(profileToForm(query.data.profile));
                  setUseSuggestedCalories(
                    shouldUseSuggested(
                      query.data.profile.caloricTarget,
                      query.data.suggested?.caloricTarget,
                    ),
                  );
                  setUseSuggestedProtein(
                    shouldUseSuggested(
                      query.data.profile.proteinTargetG,
                      query.data.suggested?.proteinTargetG,
                    ),
                  );
                }
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          )}
          {save.isError && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--rose)",
                textAlign: "center",
              }}
            >
              {getSaveErrorMessage(save.error)}
            </div>
          )}
        </div>
      </form>
    </Layout>
  );
}

function SummaryRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--hair)",
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          color: "var(--ink)",
          fontWeight: 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TargetSummaryCard({
  title,
  unit,
  value,
  isSuggested,
}: {
  title: string;
  unit: string;
  value: number | null;
  isSuggested: boolean;
}) {
  return (
    <Card tone={isSuggested ? "gradient" : "paper"}>
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
            <span style={{ fontSize: value == null ? 22 : 32 }}>
              {value ?? "Not set"}
            </span>
            {value != null && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{unit}</span>
            )}
          </div>
        </div>
        <span
          style={{
            border: "1px solid var(--hair)",
            background: isSuggested ? "var(--paper)" : "var(--ink)",
            color: isSuggested ? "var(--sumi)" : "var(--paper)",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}
        >
          {isSuggested ? "Suggested" : "Custom"}
        </span>
      </div>
    </Card>
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
    mealComplexity: profile.mealComplexity ?? "varied",
    equipment: profile.equipment ?? [],
  };
}

function shouldUseSuggested(savedValue: number | null, suggestedValue?: number | null) {
  if (suggestedValue == null) return savedValue == null;
  return savedValue === suggestedValue;
}

function isProfileComplete(profile: Profile) {
  return (
    profile.age != null &&
    profile.sex != null &&
    profile.weightLbs != null &&
    profile.heightIn != null
  );
}

function formatWeightDisplay(weightLbs: number | null, unitSystem: UnitSystem) {
  if (weightLbs == null) return "—";
  if (unitSystem === "metric") {
    return `${roundTo(poundsToKg(weightLbs), 1)} kg`;
  }
  return `${roundTo(weightLbs, 1)} lb`;
}

function formatHeightDisplay(heightIn: number | null, unitSystem: UnitSystem) {
  if (heightIn == null) return "—";
  if (unitSystem === "metric") {
    return `${roundTo(inchesToCm(heightIn), 1)} cm`;
  }
  const { feet, inches } = toFeetInches(heightIn);
  return `${feet ?? 0}′ ${inches ?? 0}″`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function getSaveErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    return error.response.data.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "We couldn't save your profile right now.";
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
