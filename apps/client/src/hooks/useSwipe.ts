import { useRef, type PointerEvent } from "react";

/**
 * Horizontal swipe detection via pointer events. Uses a 12px intent slop:
 * once horizontal movement wins, vertical scrolling continues to work
 * because we never preventDefault — we only classify the gesture.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);

  const onPointerDown = (e: PointerEvent) => {
    // Touch only — mouse drags shouldn't switch days.
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY };
    horizontal.current = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!start.current || horizontal.current) return;
    const dx = Math.abs(e.clientX - start.current.x);
    const dy = Math.abs(e.clientY - start.current.y);
    if (dx > 12 && dx > dy * 1.5) horizontal.current = true;
  };

  const onPointerUp = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || !horizontal.current) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < threshold) return;
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
