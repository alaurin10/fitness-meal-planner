import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Sheet } from "./Sheet";

interface Props {
  open: boolean;
  title: string;
  onSubmit: (suggestion: string) => void;
  onClose: () => void;
}

export function RegenerateHintModal({ open, title, onSubmit, onClose }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  function handleSubmit() {
    onSubmit(text.trim());
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} aria-label={title} zIndex={60} maxWidth={480}>
      <div
        style={{
          padding: "4px 0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
          {title}
        </div>
        <IconButton variant="ghost" size={32} onClick={onClose} aria-label="Close">
          <Icon name="x" size={20} />
        </IconButton>
      </div>

      <div style={{ paddingBottom: 14 }}>
        <textarea
          className="field-input"
          placeholder="Any preferences? (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-autofocus
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

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit}>
          <Icon name="sparkle" size={14} />
          Regenerate
        </Button>
      </div>
    </Sheet>
  );
}
