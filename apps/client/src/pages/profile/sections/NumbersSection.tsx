import { useState } from "react";
import { Card } from "../../../components/Card";
import type { Profile } from "../../../hooks/useProfile";
import type { UnitSystem } from "../../../lib/units";
import { EditSheet, SectionHeader } from "../EditSheet";
import { NumbersFields, SummaryRow, type NumbersValue } from "../fields";
import {
  capitalize,
  formatHeightDisplay,
  formatWeightDisplay,
  getSaveErrorMessage,
} from "../helpers";
import type { SaveSection } from "../types";

export function NumbersSection({
  profile,
  unitSystem,
  onSave,
  saving,
}: {
  profile: Profile;
  unitSystem: UnitSystem;
  onSave: SaveSection;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NumbersValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => {
    setDraft({
      unitSystem,
      age: profile.age,
      sex: profile.sex,
      weightLbs: profile.weightLbs,
      heightIn: profile.heightIn,
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await onSave({
        age: draft.age,
        sex: draft.sex,
        weightLbs: draft.weightLbs,
        heightIn: draft.heightIn,
      });
      setOpen(false);
    } catch (e) {
      setError(getSaveErrorMessage(e));
    }
  };

  return (
    <div>
      <SectionHeader label="Your numbers" onEdit={openEditor} className="px-2 pb-2" />
      <Card>
        <SummaryRow label="Age" value={profile.age != null ? `${profile.age} yrs` : "—"} />
        <SummaryRow label="Sex" value={profile.sex ? capitalize(profile.sex) : "—"} />
        <SummaryRow label="Weight" value={formatWeightDisplay(profile.weightLbs, unitSystem)} />
        <SummaryRow
          label="Height"
          value={formatHeightDisplay(profile.heightIn, unitSystem)}
          last
        />
      </Card>
      <div
        style={{
          marginTop: 8,
          fontSize: 11.5,
          color: "var(--muted)",
          textAlign: "center",
        }}
      >
        Weight updates automatically when you log it on the Progress page.
      </div>

      <EditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Your numbers"
        onSave={save}
        saving={saving}
        error={error}
        position="center"
      >
        {draft && (
          <NumbersFields
            value={draft}
            onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          />
        )}
      </EditSheet>
    </div>
  );
}
