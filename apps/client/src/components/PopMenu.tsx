import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
 *
 * The dropdown renders in a portal with fixed positioning so it is never
 * clipped by an ancestor's `overflow: hidden` (e.g. the collapsing grocery
 * category sections). It flips above the trigger when there isn't room below.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Start offscreen so the first (measuring) layout pass doesn't flash.
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });

  // Outside-click dismissal: the menu lives in a portal, so check both the
  // trigger and the portalled menu before closing.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onToggle();
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open, onToggle]);

  // A fixed-positioned menu can't follow the trigger when the page scrolls,
  // so close it instead — standard menu behavior.
  useEffect(() => {
    if (!open) return;
    function close() {
      onToggle();
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, onToggle]);

  // Position after the menu mounts so we can measure its real size and flip
  // above the trigger / clamp into the viewport as needed.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = triggerRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const r = btn.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const gap = 4;
    const margin = 8;

    let top = r.bottom + gap;
    // Flip above if it would overflow the viewport bottom and there's more
    // room above the trigger.
    if (top + m.height > window.innerHeight - margin && r.top > m.height + gap) {
      top = r.top - gap - m.height;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - m.height - margin));

    // Right-align the menu to the trigger, clamped into the viewport.
    let left = r.right - m.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - m.width - margin));

    setCoords({ top, left });
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="fade-up popmenu glass glass-strong"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: 188,
              borderRadius: "var(--radius-sm)",
              boxShadow: "inset 0 1px 0 var(--glass-highlight), var(--shadow-lg)",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              zIndex: 1000,
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
                  borderRadius: "var(--radius-xs)",
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
          </div>,
          document.body,
        )}
    </>
  );
}
