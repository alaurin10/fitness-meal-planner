import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";

/**
 * Shared shell for the per-section profile editors: a Sheet with a title,
 * the section's fields, an inline error slot, and Save/Cancel actions.
 * Sections with keyboard input should pass position="center" (see Sheet).
 */
export function EditSheet({
  open,
  onClose,
  title,
  onSave,
  saving,
  error,
  position = "auto",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  position?: "auto" | "center";
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} aria-label={`Edit ${title}`} position={position}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        style={{ padding: "10px 4px 4px" }}
      >
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          {title}
        </div>

        {children}

        {error && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--rose)",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Eyebrow + edit affordance header used above each profile summary card. */
export function SectionHeader({
  label,
  onEdit,
  className = "",
}: {
  label: string;
  onEdit: () => void;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div className="eyebrow">{label}</div>
      <button
        type="button"
        onClick={onEdit}
        className="tappable"
        style={{
          background: "none",
          border: "none",
          padding: "2px 4px",
          cursor: "pointer",
          color: "var(--accent)",
          fontFamily: "var(--font-body)",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        Edit
      </button>
    </div>
  );
}
