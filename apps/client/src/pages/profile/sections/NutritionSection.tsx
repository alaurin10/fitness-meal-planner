import { useState } from "react";
import { Card } from "../../../components/Card";
import type { MealComplexity, Profile } from "../../../hooks/useProfile";
import { MEAL_COMPLEXITY, MEAL_COMPLEXITY_LABEL } from "../constants";
import { EditSheet, SectionHeader } from "../EditSheet";
import { DietaryNotesField, IconChoiceGrid, SummaryRow, sectionLabelStyle } from "../fields";
import { getSaveErrorMessage } from "../helpers";
import type { SaveSection } from "../types";

interface NutritionDraft {
  mealComplexity: MealComplexity;
  dietaryNotes: string | null;
}

export function NutritionSection({
  profile,
  onSave,
  saving,
}: {
  profile: Profile;
  onSave: SaveSection;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NutritionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => {
    setDraft({
      mealComplexity: profile.mealComplexity ?? "varied",
      dietaryNotes: profile.dietaryNotes,
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

  const hasNotes = profile.dietaryNotes && profile.dietaryNotes.trim() !== "";

  return (
    <div>
      <SectionHeader label="Nutrition" onEdit={openEditor} className="px-2 pb-2" />
      <Card>
        <SummaryRow
          label="Plan style"
          value={MEAL_COMPLEXITY_LABEL[profile.mealComplexity ?? "varied"]}
          last={!hasNotes}
        />
        {hasNotes && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
              Dietary notes
            </div>
            <div style={{ fontSize: 13.5, color: "var(--sumi)", lineHeight: 1.5 }}>
              {profile.dietaryNotes}
            </div>
          </div>
        )}
      </Card>

      <EditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nutrition"
        onSave={save}
        saving={saving}
        error={error}
        position="center"
      >
        {draft && (
          <div style={{ display: "grid", gap: 18 }}>
            <IconChoiceGrid
              label="How should plans look?"
              options={MEAL_COMPLEXITY}
              value={draft.mealComplexity}
              onChange={(mealComplexity) => setDraft((d) => (d ? { ...d, mealComplexity } : d))}
              columns={3}
              hint={MEAL_COMPLEXITY.find((o) => o.value === draft.mealComplexity)?.hint}
            />
            <div>
              <div style={sectionLabelStyle}>Dietary notes</div>
              <DietaryNotesField
                value={draft.dietaryNotes}
                onChange={(dietaryNotes) => setDraft((d) => (d ? { ...d, dietaryNotes } : d))}
              />
            </div>
          </div>
        )}
      </EditSheet>
    </div>
  );
}
