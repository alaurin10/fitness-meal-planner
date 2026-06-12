import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useToast } from "../../components/Toast";
import {
  useSaveProfile,
  type Profile,
  type ProfileInput,
} from "../../hooks/useProfile";
import { useSettings } from "../../hooks/useSettings";
import { useWeekStartDay } from "../../hooks/useWeekStartDay";
import { computeSuggestedTargets } from "../../lib/targets";
import { EMPTY, MEAL_COMPLEXITY, WORKOUT_STYLES } from "./constants";
import {
  DietaryNotesField,
  EquipmentPicker,
  ExperiencePicker,
  GoalPicker,
  HydrationControl,
  IconChoiceGrid,
  NumbersFields,
  TargetCard,
  TrainingDaysPicker,
  sectionLabelStyle,
} from "./fields";
import { getSaveErrorMessage, profileToForm, shouldUseSuggested } from "./helpers";

/**
 * One-shot full profile form shown until a complete profile exists. Once the
 * first save lands, the invalidated profile query flips the tab to the
 * per-section summary view.
 */
export function SetupForm({ profile }: { profile: Profile | null }) {
  const settingsQuery = useSettings();
  const weekStartDay = useWeekStartDay();
  const save = useSaveProfile();
  const toast = useToast();
  const [form, setForm] = useState<ProfileInput>(() =>
    profile ? profileToForm(profile) : EMPTY,
  );
  const [useSuggestedCalories, setUseSuggestedCalories] = useState(true);
  const [useSuggestedProtein, setUseSuggestedProtein] = useState(true);

  // An incomplete profile may still carry saved custom targets — honor them.
  useEffect(() => {
    if (!profile) return;
    const suggested = computeSuggestedTargets({
      sex: profile.sex,
      age: profile.age,
      weightLbs: profile.weightLbs,
      heightIn: profile.heightIn,
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
      goal: profile.goal,
    });
    setUseSuggestedCalories(shouldUseSuggested(profile.caloricTarget, suggested?.caloricTarget));
    setUseSuggestedProtein(shouldUseSuggested(profile.proteinTargetG, suggested?.proteinTargetG));
    // Only on first mount — afterwards the user owns the toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsQuery.data?.unitSystem) return;
    setForm((current) => ({
      ...current,
      unitSystem: settingsQuery.data?.unitSystem ?? "imperial",
    }));
  }, [settingsQuery.data?.unitSystem]);

  const upd = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const payload: ProfileInput = {
          ...form,
          caloricTarget: useSuggestedCalories ? undefined : form.caloricTarget,
          proteinTargetG: useSuggestedProtein ? undefined : form.proteinTargetG,
        };

        save.mutate(payload, {
          onSuccess: () => toast.success("Profile saved"),
        });
      }}
    >
      <div className="px-6 pt-4 pb-2">
        <div className="eyebrow">Your numbers</div>
      </div>
      <div className="px-4">
        <Card>
          <NumbersFields
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />
        </Card>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="eyebrow">Training</div>
      </div>
      <div className="px-4">
        <Card>
          <div style={{ marginBottom: 18 }}>
            <ExperiencePicker
              value={form.experienceLevel}
              onChange={(v) => upd("experienceLevel", v)}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <TrainingDaysPicker
              days={form.trainingDays ?? []}
              daysPerWeek={form.trainingDaysPerWeek}
              weekStartDay={weekStartDay}
              onChange={(next) =>
                setForm((f) => ({
                  ...f,
                  trainingDays: next,
                  trainingDaysPerWeek: next.length || f.trainingDaysPerWeek,
                }))
              }
            />
          </div>
          <GoalPicker value={form.goal} onChange={(v) => upd("goal", v)} />
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
        <Card>
          <HydrationControl
            value={form.hydrationGoal ?? 8}
            onChange={(value) => upd("hydrationGoal", value)}
          />
        </Card>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="eyebrow">Meal style</div>
      </div>
      <div className="px-4">
        <Card>
          <IconChoiceGrid
            label="How should plans look?"
            options={MEAL_COMPLEXITY}
            value={form.mealComplexity}
            onChange={(v) => upd("mealComplexity", v)}
            columns={3}
            hint={MEAL_COMPLEXITY.find((o) => o.value === form.mealComplexity)?.hint}
          />
        </Card>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="eyebrow">Workout style</div>
      </div>
      <div className="px-4">
        <Card>
          <IconChoiceGrid
            label="How should workouts be structured?"
            options={WORKOUT_STYLES}
            value={form.workoutStyle}
            onChange={(v) => upd("workoutStyle", v)}
            columns={2}
            hint={WORKOUT_STYLES.find((o) => o.value === form.workoutStyle)?.hint}
          />
        </Card>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="eyebrow">Equipment</div>
      </div>
      <div className="px-4">
        <Card>
          <EquipmentPicker
            value={form.equipment}
            onChange={(v) => upd("equipment", v)}
          />
        </Card>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="eyebrow">Dietary notes</div>
      </div>
      <div className="px-4">
        <Card>
          <div style={sectionLabelStyle}>Anything plans should respect?</div>
          <DietaryNotesField
            value={form.dietaryNotes ?? null}
            onChange={(v) => upd("dietaryNotes", v)}
          />
        </Card>
      </div>

      <div className="px-4 pt-5">
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
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
  );
}
