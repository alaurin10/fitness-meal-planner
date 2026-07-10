import { useState } from "react";
import type { MealSlot } from "../lib/types";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { SegmentedControl } from "./SegmentedControl";
import { Sheet } from "./Sheet";

const SLOT_OPTIONS: readonly { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

interface Props {
  open: boolean;
  /** Slot pre-selected when the sheet opens (e.g. the day's next free slot). */
  defaultSlot?: MealSlot;
  onGenerate: (slot: MealSlot) => void;
  onPickFromBook: (slot: MealSlot) => void;
  onClose: () => void;
}

/**
 * Add a new meal to a day: pick which slot it belongs to, then either
 * generate it with AI or pick it from the recipe book. Mount-gated so the
 * slot selection re-initializes from `defaultSlot` on every open.
 */
export function AddMealSheet({ open, defaultSlot, onGenerate, onPickFromBook, onClose }: Props) {
  if (!open) return null;
  return (
    <Content
      defaultSlot={defaultSlot}
      onGenerate={onGenerate}
      onPickFromBook={onPickFromBook}
      onClose={onClose}
    />
  );
}

function Content({ defaultSlot, onGenerate, onPickFromBook, onClose }: Omit<Props, "open">) {
  const [slot, setSlot] = useState<MealSlot>(defaultSlot ?? "snack");

  return (
    <Sheet open onClose={onClose} aria-label="Add a meal">
      <div style={{ paddingTop: 6 }}>
        <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
          Add a meal
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          Choose a slot, then generate it or pick from your book.
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <SegmentedControl
            aria-label="Meal slot"
            options={SLOT_OPTIONS}
            value={slot}
            onChange={setSlot}
            minSegmentWidth={68}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
          <Button variant="accent" size="lg" className="w-full" onClick={() => onGenerate(slot)}>
            <Icon name="sparkle" size={16} />
            Generate with AI
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => onPickFromBook(slot)}>
            <Icon name="fork" size={16} />
            Pick from recipe book
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
