import { useIsDesktop } from "../hooks/useIsDesktop";
import type { MealSlot, RecipeListItem } from "../lib/types";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Sheet } from "./Sheet";
import { RecipeBrowser } from "./RecipeBrowser";
import { CATEGORY_LABEL } from "./RecipeFilterChips";

interface Props {
  open: boolean;
  slot?: MealSlot;
  onPick: (recipe: RecipeListItem) => void;
  onClose: () => void;
}

export function RecipePickerModal({ open, slot, onPick, onClose }: Props) {
  // Mount gate: PickerContent remounts on every open so search/filter state
  // resets and re-initializes from the current slot.
  if (!open) return null;
  return <PickerContent slot={slot} onPick={onPick} onClose={onClose} />;
}

function PickerContent({ slot, onPick, onClose }: Omit<Props, "open">) {
  const isDesktop = useIsDesktop();

  return (
    <Sheet
      open
      onClose={onClose}
      aria-label="Pick a recipe"
      zIndex={60}
      maxWidth={960}
      style={{
        height: isDesktop ? "min(88vh, 900px)" : "calc(100dvh - 24px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: 0,
        paddingBottom: isDesktop ? 12 : "calc(env(safe-area-inset-bottom, 16px) + 12px)",
      }}
    >
      <>
        <div
          style={{
            padding: isDesktop ? "14px 18px 10px" : "4px 18px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
              Pick a recipe
            </div>
            {slot && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Adding {CATEGORY_LABEL[slot]}
              </div>
            )}
          </div>
          <IconButton variant="ghost" size={32} onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </IconButton>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "0 18px",
          }}
        >
          <RecipeBrowser
            slot={slot}
            onPick={onPick}
            gridClassName="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3"
          />
        </div>

        <div style={{ padding: "0 18px" }}>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </>
    </Sheet>
  );
}
