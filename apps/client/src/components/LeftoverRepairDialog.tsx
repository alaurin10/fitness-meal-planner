import { Button } from "./Button";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import type { AffectedLeftover } from "../hooks/useMealPlan";

/**
 * Shown after a meal with dependent leftovers is replaced: the linked
 * leftover meals still describe the OLD meal, so the user picks what should
 * happen to them. "Leave as is" simply closes — no server call.
 */
export function LeftoverRepairDialog({
  open,
  sourceName,
  newSourceName,
  affected,
  busy,
  onUpdate,
  onRegenerate,
  onClose,
}: {
  open: boolean;
  /** Name of the meal that was replaced. */
  sourceName: string;
  /** Name of the meal now in its place (if known). */
  newSourceName?: string;
  affected: AffectedLeftover[];
  busy?: boolean;
  onUpdate: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const count = affected.length;
  const label = count === 1 ? "meal was" : "meals were";
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} aria-label="Linked leftovers">
      <div style={{ padding: "6px 4px 4px" }}>
        <div className="title-md">Linked leftovers</div>
        <p className="text-body" style={{ marginTop: 8 }}>
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>{sourceName}</b> was replaced
          {newSourceName ? (
            <>
              {" "}with <b style={{ color: "var(--ink)", fontWeight: 600 }}>{newSourceName}</b>
            </>
          ) : null}
          . {count} later {label} its leftovers:
        </p>
        <ul style={{ margin: "10px 0 0", paddingLeft: 0, listStyle: "none" }}>
          {affected.map((a) => (
            <li
              key={`${a.day}:${a.index}`}
              className="text-body"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
              }}
            >
              <Icon name="swap" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span>
                <b style={{ color: "var(--ink)", fontWeight: 500 }}>{a.day}</b> · {a.name}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          <Button size="lg" variant="accent" onClick={onUpdate} disabled={busy}>
            <Icon name="swap" size={16} />
            {busy ? "Updating…" : `Update to ${newSourceName ? `${newSourceName} leftovers` : "new leftovers"}`}
          </Button>
          <Button size="lg" variant="ghost" onClick={onRegenerate} disabled={busy}>
            <Icon name="sparkle" size={16} />
            Regenerate fresh meals
          </Button>
          <Button size="lg" variant="plain" onClick={onClose} disabled={busy}>
            Leave as is
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
