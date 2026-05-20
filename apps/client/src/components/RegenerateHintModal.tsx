import { useEffect, useState } from "react";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  title: string;
  onSubmit: (suggestion: string) => void;
  onClose: () => void;
}

export function RegenerateHintModal({ open, title, onSubmit, onClose }: Props) {
  const isDesktop = useIsDesktop();
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    onSubmit(text.trim());
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isDesktop ? 480 : 480,
          background: "var(--bg)",
          borderRadius: isDesktop ? 24 : undefined,
          borderTopLeftRadius: isDesktop ? undefined : 24,
          borderTopRightRadius: isDesktop ? undefined : 24,
          display: "flex",
          flexDirection: "column",
          paddingBottom: isDesktop ? 16 : "calc(env(safe-area-inset-bottom, 16px) + 16px)",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <div style={{ padding: "0 18px 14px" }}>
          <textarea
            className="field-input"
            placeholder="Any preferences? (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={3}
            maxLength={500}
            style={{ width: "100%", resize: "vertical", minHeight: 80 }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              marginTop: 6,
            }}
          >
            Leave blank to regenerate without a hint.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "0 18px" }}>
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit}>
            <Icon name="sparkle" size={14} />
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
