import { useState } from "react";
import { Card } from "../../../components/Card";
import type { Profile, SuggestedTargets } from "../../../hooks/useProfile";
import { EditSheet, SectionHeader } from "../EditSheet";
import { HydrationControl, TargetCard, TargetSummaryCard } from "../fields";
import { getSaveErrorMessage, shouldUseSuggested } from "../helpers";
import type { SaveSection } from "../types";

interface TargetsDraft {
  caloricTarget: number | null;
  proteinTargetG: number | null;
  hydrationGoal: number;
  useSuggestedCalories: boolean;
  useSuggestedProtein: boolean;
}

export function TargetsSection({
  profile,
  suggested,
  onSave,
  saving,
}: {
  profile: Profile;
  suggested: SuggestedTargets | null;
  onSave: SaveSection;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TargetsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const caloriesAreSuggested = shouldUseSuggested(
    profile.caloricTarget,
    suggested?.caloricTarget,
  );
  const proteinIsSuggested = shouldUseSuggested(
    profile.proteinTargetG,
    suggested?.proteinTargetG,
  );

  const openEditor = () => {
    setDraft({
      caloricTarget: profile.caloricTarget,
      proteinTargetG: profile.proteinTargetG,
      hydrationGoal: profile.hydrationGoal ?? 8,
      useSuggestedCalories: caloriesAreSuggested,
      useSuggestedProtein: proteinIsSuggested,
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await onSave(
        {
          caloricTarget: draft.caloricTarget,
          proteinTargetG: draft.proteinTargetG,
          hydrationGoal: draft.hydrationGoal,
        },
        {
          useSuggestedCalories: draft.useSuggestedCalories,
          useSuggestedProtein: draft.useSuggestedProtein,
        },
      );
      setOpen(false);
    } catch (e) {
      setError(getSaveErrorMessage(e));
    }
  };

  return (
    <div>
      <SectionHeader label="Daily targets" onEdit={openEditor} className="px-2 pb-2" />
      <div className="space-y-2.5">
        <TargetSummaryCard
          title="Calories"
          unit="kcal"
          value={profile.caloricTarget}
          isSuggested={caloriesAreSuggested}
        />
        <TargetSummaryCard
          title="Protein"
          unit="g"
          value={profile.proteinTargetG}
          isSuggested={proteinIsSuggested}
        />
        <TargetSummaryCard
          title="Hydration"
          unit="cups / day"
          value={profile.hydrationGoal}
          isSuggested={false}
        />
      </div>

      <EditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Daily targets"
        onSave={save}
        saving={saving}
        error={error}
        position="center"
      >
        {draft && (
          <div style={{ display: "grid", gap: 10 }}>
            <TargetCard
              title="Calories"
              unit="kcal"
              helper="Estimated from your body size, training days, and goal."
              value={draft.caloricTarget ?? ""}
              suggestedValue={suggested?.caloricTarget ?? null}
              useSuggested={draft.useSuggestedCalories}
              onToggle={() =>
                setDraft((d) =>
                  d ? { ...d, useSuggestedCalories: !d.useSuggestedCalories } : d,
                )
              }
              onChange={(caloricTarget) => setDraft((d) => (d ? { ...d, caloricTarget } : d))}
              min={1200}
              max={6000}
            />
            <TargetCard
              title="Protein"
              unit="g"
              helper="Estimated to support recovery and your current goal."
              value={draft.proteinTargetG ?? ""}
              suggestedValue={suggested?.proteinTargetG ?? null}
              useSuggested={draft.useSuggestedProtein}
              onToggle={() =>
                setDraft((d) =>
                  d ? { ...d, useSuggestedProtein: !d.useSuggestedProtein } : d,
                )
              }
              onChange={(proteinTargetG) =>
                setDraft((d) => (d ? { ...d, proteinTargetG } : d))
              }
              min={40}
              max={300}
            />
            <Card>
              <HydrationControl
                value={draft.hydrationGoal}
                onChange={(hydrationGoal) => setDraft((d) => (d ? { ...d, hydrationGoal } : d))}
              />
            </Card>
          </div>
        )}
      </EditSheet>
    </div>
  );
}
