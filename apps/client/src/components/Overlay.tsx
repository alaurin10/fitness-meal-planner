import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shared backdrop + portal behavior for Modal and Sheet: scroll lock,
 * Escape handling, focus trap with focus restore, and enter/exit
 * animations driven by [data-state] (styles in tokens.css).
 */

let scrollLocks = 0;

function lockBodyScroll() {
  if (scrollLocks === 0) document.body.style.overflow = "hidden";
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = "";
  };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  "aria-label": string;
  /** center → modal, bottom → sheet */
  align: "center" | "bottom";
  zIndex?: number;
  children: ReactNode;
  panelClassName: string;
  panelStyle?: React.CSSProperties;
  /** Extra transform applied while dragging (Sheet). */
  dragOffset?: number;
  onPanelPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  panelRef?: React.RefObject<HTMLDivElement>;
}

export function Overlay({
  open,
  onClose,
  align,
  zIndex = 70,
  children,
  panelClassName,
  panelStyle,
  dragOffset = 0,
  onPanelPointerDown,
  panelRef,
  ...rest
}: OverlayProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const localPanelRef = useRef<HTMLDivElement>(null);
  const panel = panelRef ?? localPanelRef;
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mount immediately on open; keep mounted briefly on close for the exit animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();

    const focusFirst = () => {
      const preferred = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
      const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? panel.current)?.focus();
    };
    // Wait a frame so the panel exists and transitions don't cancel focus.
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        const focusables = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      unlock();
      restoreFocusRef.current?.focus?.();
    };
  }, [mounted, onClose, panel]);

  if (!mounted) return null;

  const state = open && shown ? "open" : "closed";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={rest["aria-label"]}
      className="overlay-backdrop"
      data-state={state}
      onClick={onClose}
      style={{
        zIndex,
        display: "flex",
        alignItems: align === "center" ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={panelClassName}
        data-state={state}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPanelPointerDown}
        style={{
          ...panelStyle,
          ...(dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : {}),
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
