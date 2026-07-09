import { Button } from "../Button";
import { Icon } from "../Icon";
import { Sheet } from "../Sheet";
import type { MealDay, MealSlot } from "../../lib/types";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Tap-target sheet for one grid cell: generate / pick from book / keep / skip. */
export function CellActionSheet({
  open,
  day,
  slot,
  hasExistingMeal,
  onGenerate,
  onPickFromBook,
  onKeep,
  onSkip,
  onClose,
}: {
  open: boolean;
  day: MealDay["day"] | null;
  slot: MealSlot | null;
  hasExistingMeal?: boolean;
  onGenerate: () => void;
  onPickFromBook: () => void;
  onKeep: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  if (!open || !day || !slot) return null;
  return (
    <Sheet open onClose={onClose} aria-label="Assign meal" position="center" maxWidth={380}>
      <div style={{ padding: "6px 4px 4px" }}>
        <div className="eyebrow">{day}</div>
        <div className="title-md" style={{ marginTop: 2 }}>
          {SLOT_LABEL[slot]}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          <Button size="lg" variant="accent" onClick={onGenerate}>
            <Icon name="sparkle" size={16} />
            Generate with AI
          </Button>
          <Button size="lg" variant="ghost" onClick={onPickFromBook}>
            <Icon name="fork" size={16} />
            Pick from book
          </Button>
          {hasExistingMeal && (
            <Button size="lg" variant="ghost" onClick={onKeep}>
              <Icon name="check" size={16} />
              Keep current meal
            </Button>
          )}
          <Button size="lg" variant="plain" onClick={onSkip}>
            <Icon name="x" size={16} />
            Skip this meal
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
