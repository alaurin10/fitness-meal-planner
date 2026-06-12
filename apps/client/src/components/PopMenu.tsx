import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface PopMenuItem {
  icon: IconName;
  label: string;
  tone?: "rose";
  onSelect: () => void;
}

/**
 * Ellipsis trigger + dropdown action menu with outside-click dismissal.
 * Controlled: the parent owns `open` so only one menu shows at a time.
 */
export function PopMenu({
  open,
  onToggle,
  items,
  disabled,
  "aria-label": ariaLabel,
  trigger,
}: {
  open: boolean;
  onToggle: () => void;
  items: PopMenuItem[];
  disabled?: boolean;
  "aria-label": string;
  /** Custom trigger content; defaults to an ellipsis icon. */
  trigger?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onToggle]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        className="tappable"
        style={{
          width: 32,
          height: 32,
          borderRadius: 99,
          border: "1px solid var(--hair)",
          background: "var(--paper)",
          color: "var(--sumi)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {trigger ?? <Icon name="ellipsis" size={16} />}
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="fade-up popmenu"
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            minWidth: 188,
            background: "var(--paper)",
            border: "1px solid var(--hair)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            zIndex: 20,
            animationDuration: "180ms",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="popmenu-item"
              onClick={(e) => {
                e.stopPropagation();
                item.onSelect();
              }}
              style={{
                background: "transparent",
                border: "none",
                textAlign: "left",
                padding: "9px 10px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13.5,
                color: item.tone === "rose" ? "var(--rose)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              <Icon name={item.icon} size={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
