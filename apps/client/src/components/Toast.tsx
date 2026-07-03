import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/**
 * App-wide toast notifications. Mount <ToastProvider> once (main.tsx) and
 * call `useToast().success(...)` / `.error(...)` anywhere below it.
 * Renders above the mobile bottom nav, max 2 stacked, auto-dismissing.
 */

interface ToastItem {
  id: number;
  kind: "success" | "error";
  message: string;
  leaving?: boolean;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const SHOW_MS = 2600;
const LEAVE_MS = 220;
const MAX_VISIBLE = 2;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_MS);
  }, []);

  const push = useCallback(
    (kind: ToastItem["kind"], message: string) => {
      const id = nextId.current++;
      setToasts((prev) => {
        const next = [...prev, { id, kind, message }];
        // Evict the oldest beyond the cap (it leaves immediately).
        const active = next.filter((t) => !t.leaving);
        const oldest = active[0];
        if (active.length > MAX_VISIBLE && oldest) {
          setTimeout(() => dismiss(oldest.id), 0);
        }
        return next;
      });
      setTimeout(() => dismiss(id), SHOW_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            zIndex: 90,
            pointerEvents: "none",
            padding: "0 16px",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`glass glass-strong ${t.leaving ? "toast-leave" : "fade-up"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: 420,
                padding: "10px 16px",
                borderRadius: 999,
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 500,
                boxShadow: "inset 0 1px 0 var(--glass-highlight), var(--shadow-lg)",
                pointerEvents: "auto",
              }}
              onClick={() => dismiss(t.id)}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  color: t.kind === "error" ? "var(--rose)" : "var(--moss)",
                }}
              >
                <Icon name={t.kind === "error" ? "x" : "check"} size={14} stroke={2.5} />
              </span>
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
