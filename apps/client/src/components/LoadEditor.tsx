import { useState } from "react";
import {
  kgToPounds,
  poundsToKg,
  roundTo,
  weightUnitLabel,
  type UnitSystem,
} from "../lib/units";

/**
 * Inline editor for an exercise's prescribed load. Renders next to the
 * exercise name where the static "135 lb" pill normally sits. Saving
 * patches the active plan AND records a new PR in the progress log so
 * future generated plans anchor to this weight. Shared by the Workouts
 * list and the on-your-watch reference screen.
 */
export function LoadEditor({
  initialLoadLbs,
  unitSystem,
  saving,
  onSave,
  onCancel,
}: {
  initialLoadLbs: number | null;
  unitSystem: UnitSystem;
  saving: boolean;
  onSave: (loadLbs: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const initialDisplay =
    initialLoadLbs !== null
      ? unitSystem === "metric"
        ? roundTo(poundsToKg(initialLoadLbs), 1)
        : roundTo(initialLoadLbs, 0)
      : "";
  const [value, setValue] = useState<string>(String(initialDisplay));
  const unitLabel = weightUnitLabel(unitSystem);

  function commit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      onCancel();
      return;
    }
    const lbs = unitSystem === "metric" ? kgToPounds(n) : n;
    onSave(roundTo(lbs, 2));
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={commit}
        disabled={saving}
        style={{
          width: 72,
          padding: "4px 6px",
          // 16px min avoids iOS Safari's auto-zoom on focus.
          fontSize: 16,
          border: "1px solid var(--accent)",
          borderRadius: 6,
          fontFamily: "var(--font-body)",
          background: "var(--paper)",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{unitLabel}</span>
    </div>
  );
}
