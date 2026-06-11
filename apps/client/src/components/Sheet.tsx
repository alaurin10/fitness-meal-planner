import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Overlay } from "./Overlay";

/**
 * Bottom sheet on mobile (drag handle, drag-to-dismiss), centered modal on
 * desktop. Pass `position="center"` to force the centered layout everywhere
 * (e.g. when the on-screen keyboard would push a bottom sheet around).
 */
export function Sheet({
  open,
  onClose,
  children,
  maxWidth = 420,
  position = "auto",
  zIndex,
  style,
  ...rest
}: {
  open: boolean;
  onClose: () => void;
  "aria-label": string;
  children: ReactNode;
  maxWidth?: number;
  position?: "auto" | "center";
  zIndex?: number;
  style?: CSSProperties;
}) {
  const isDesktop = useIsDesktop();
  const asSheet = position === "auto" && !isDesktop;
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startTime: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!asSheet) return;
    // Only start a dismiss drag from the handle region so inner content scrolls freely.
    const target = e.target as HTMLElement;
    if (!target.closest("[data-sheet-handle]")) return;
    drag.current = { startY: e.clientY, startTime: Date.now() };
    target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setDragOffset(Math.max(0, e.clientY - drag.current.startY));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const dt = Math.max(1, Date.now() - drag.current.startTime);
    const velocity = dy / dt; // px per ms
    const height = panelRef.current?.offsetHeight ?? 400;
    drag.current = null;
    setDragOffset(0);
    if (dy > height * 0.3 || velocity > 0.5) onClose();
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      aria-label={rest["aria-label"]}
      align={asSheet ? "bottom" : "center"}
      zIndex={zIndex}
      panelRef={panelRef}
      panelClassName={asSheet ? "sheet-panel" : "modal-panel"}
      panelStyle={{ maxWidth, ...style }}
      dragOffset={dragOffset}
      onPanelPointerDown={onPointerDown}
    >
      {asSheet && (
        <div
          data-sheet-handle
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ padding: "10px 0 6px", touchAction: "none", cursor: "grab" }}
          aria-hidden
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "color-mix(in srgb, var(--muted) 40%, transparent)",
              margin: "0 auto",
            }}
          />
        </div>
      )}
      {children}
    </Overlay>
  );
}
