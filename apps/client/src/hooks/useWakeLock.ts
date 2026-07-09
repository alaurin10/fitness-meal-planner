import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `active` is true, e.g. during guided cooking.
 * The OS releases the lock whenever the tab is backgrounded, so it's
 * re-acquired on visibilitychange. Unsupported browsers (iOS Safari) no-op.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch {
        // Unsupported, denied, or backgrounded at request time — no-op.
      }
    }

    acquire();

    function onVisibility() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
