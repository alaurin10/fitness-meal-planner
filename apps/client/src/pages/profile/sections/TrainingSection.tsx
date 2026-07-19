import { useState } from "react";
import type { DayLabel } from "@platform/shared";
import { Card } from "../../../components/Card";
import { Icon } from "../../../components/Icon";
import { Chip } from "../../../components/Primitives";
import type {
  EquipmentId,
  Profile,
  ProfileInput,
  VarietyStrength,
  WorkoutDuration,
  WorkoutStyle,
  WorkoutType,
} from "../../../hooks/useProfile";
import { useWeekStartDay } from "../../../hooks/useWeekStartDay";
import {
  EQUIPMENT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_ICON,
  GOAL_LABEL,
  WORKOUT_STYLES,
  WORKOUT_STYLE_LABEL,
  WORKOUT_TYPE_LABEL,
  WORKOUT_VARIETY_LABEL,
} from "../constants";
import { EditSheet, SectionHeader } from "../EditSheet";
import {
  EquipmentPicker,
  ExperiencePicker,
  GoalPicker,
  IconChoiceGrid,
  SummaryRow,
  TrainingDaysPicker,
  WorkoutDurationPicker,
  WorkoutTypesPicker,
  WorkoutVarietyPicker,
} from "../fields";
import { getSaveErrorMessage } from "../helpers";
import type { SaveSection } from "../types";

interface TrainingDraft {
  experienceLevel: ProfileInput["experienceLevel"];
  trainingDays: DayLabel[];
  trainingDaysPerWeek: number;
  goal: ProfileInput["goal"];
  workoutStyle: WorkoutStyle;
  workoutDuration: WorkoutDuration;
  workoutTypes: WorkoutType[];
  workoutVariety: VarietyStrength;
  equipment: EquipmentId[];
}

export function TrainingSection({
  profile,
  onSave,
  saving,
}: {
  profile: Profile;
  onSave: SaveSection;
  saving: boolean;
}) {
  const weekStartDay = useWeekStartDay();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TrainingDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => {
    setDraft({
      experienceLevel: profile.experienceLevel,
      trainingDays: profile.trainingDays ?? [],
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
      goal: profile.goal,
      workoutStyle: profile.workoutStyle ?? "ppl",
      workoutDuration: profile.workoutDuration ?? 60,
      workoutTypes: profile.workoutTypes ?? ["lifts", "core"],
      workoutVariety: profile.workoutVariety ?? "medium",
      equipment: profile.equipment ?? [],
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await onSave(draft);
      setOpen(false);
    } catch (e) {
      setError(getSaveErrorMessage(e));
    }
  };

  return (
    <div>
      <SectionHeader label="Training" onEdit={openEditor} className="px-2 pb-2" />
      <Card>
        <SummaryRow label="Experience" value={EXPERIENCE_LABEL[profile.experienceLevel]} />
        <SummaryRow
          label="Training days"
          value={
            profile.trainingDays?.length
              ? profile.trainingDays.join(", ")
              : `${profile.trainingDaysPerWeek} days/week`
          }
        />
        <SummaryRow
          label="Goal"
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name={GOAL_ICON[profile.goal]} size={14} />
              {GOAL_LABEL[profile.goal]}
            </span>
          }
        />
        <SummaryRow label="Split" value={WORKOUT_STYLE_LABEL[profile.workoutStyle ?? "ppl"]} />
        <SummaryRow
          label="Session length"
          value={`~${profile.workoutDuration ?? 60} min`}
        />
        <SummaryRow
          label="Includes"
          value={(profile.workoutTypes ?? ["lifts", "core"])
            .map((t) => WORKOUT_TYPE_LABEL[t] ?? t)
            .join(" + ")}
        />
        <SummaryRow
          label="Variety"
          value={WORKOUT_VARIETY_LABEL[profile.workoutVariety ?? "medium"]}
          last
        />
        <div style={{ paddingTop: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Equipment</div>
          {profile.equipment && profile.equipment.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.equipment.map((id) => (
                <Chip key={id} variant="moss">
                  {EQUIPMENT_LABEL[id] ?? id}
                </Chip>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--sumi)" }}>Bodyweight only</div>
          )}
        </div>
      </Card>

      <EditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Training"
        onSave={save}
        saving={saving}
        error={error}
      >
        {draft && (
          <div style={{ display: "grid", gap: 18 }}>
            <ExperiencePicker
              value={draft.experienceLevel}
              onChange={(experienceLevel) =>
                setDraft((d) => (d ? { ...d, experienceLevel } : d))
              }
            />
            <TrainingDaysPicker
              days={draft.trainingDays}
              daysPerWeek={draft.trainingDaysPerWeek}
              weekStartDay={weekStartDay}
              onChange={(trainingDays) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        trainingDays,
                        trainingDaysPerWeek: trainingDays.length || d.trainingDaysPerWeek,
                      }
                    : d,
                )
              }
            />
            <GoalPicker
              value={draft.goal}
              onChange={(goal) => setDraft((d) => (d ? { ...d, goal } : d))}
            />
            <IconChoiceGrid
              label="Workout style"
              options={WORKOUT_STYLES}
              value={draft.workoutStyle}
              onChange={(workoutStyle) => setDraft((d) => (d ? { ...d, workoutStyle } : d))}
              columns={2}
              hint={WORKOUT_STYLES.find((o) => o.value === draft.workoutStyle)?.hint}
            />
            <WorkoutDurationPicker
              value={draft.workoutDuration}
              onChange={(workoutDuration) =>
                setDraft((d) => (d ? { ...d, workoutDuration } : d))
              }
            />
            <WorkoutTypesPicker
              value={draft.workoutTypes}
              onChange={(workoutTypes) => setDraft((d) => (d ? { ...d, workoutTypes } : d))}
            />
            <WorkoutVarietyPicker
              value={draft.workoutVariety}
              onChange={(workoutVariety) =>
                setDraft((d) => (d ? { ...d, workoutVariety } : d))
              }
            />
            <EquipmentPicker
              value={draft.equipment}
              onChange={(equipment) => setDraft((d) => (d ? { ...d, equipment } : d))}
            />
          </div>
        )}
      </EditSheet>
    </div>
  );
}
