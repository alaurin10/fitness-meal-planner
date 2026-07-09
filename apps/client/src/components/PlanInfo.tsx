import { useState } from "react";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface Section {
  /** Optional eyebrow label above the paragraph. */
  label?: string;
  text: string;
}

/**
 * Small "ⓘ"-style button that reveals plan prose (summary, progression notes)
 * in a modal on demand — keeps long blurbs off the page while still letting the
 * user read them. Renders nothing when there's no non-empty content.
 */
export function PlanInfo({ title, sections }: { title: string; sections: Section[] }) {
  const [open, setOpen] = useState(false);

  const visible = sections.filter((s) => s.text?.trim());
  if (visible.length === 0) return null;

  return (
    <>
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen(true)}
        className="tappable"
        style={{
          width: 34,
          height: 34,
          borderRadius: 99,
          border: "1px solid var(--hair)",
          background: "var(--paper)",
          color: "var(--sumi)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <Icon name="note" size={16} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        aria-label={title}
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            {title}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--sumi)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map((s, i) => (
            <div key={i}>
              {s.label && (
                <div className="eyebrow" style={{ marginBottom: 4 }}>
                  {s.label}
                </div>
              )}
              <div style={{ fontSize: 13.5, color: "var(--sumi)", lineHeight: 1.55 }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
