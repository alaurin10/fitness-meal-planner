import { useCallback, useEffect, useRef, useState } from "react";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDesktop = useIsDesktop();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={options.title}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 70,
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg)",
          borderRadius: isDesktop ? 24 : undefined,
          borderTopLeftRadius: isDesktop ? undefined : 24,
          borderTopRightRadius: isDesktop ? undefined : 24,
          display: "flex",
          flexDirection: "column",
          padding: "18px 18px 16px",
          paddingBottom: isDesktop ? 16 : "calc(env(safe-area-inset-bottom, 16px) + 16px)",
        }}
      >
        <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
          {options.title}
        </div>
        {options.message && (
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
            {options.message}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            ref={confirmRef}
            variant={options.destructive ? "accent" : "primary"}
            className="flex-1"
            onClick={onConfirm}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * Promise-based confirmation to replace the native, unstyled `window.confirm`.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (await confirm({ title: "Remove this?", destructive: true })) { ... }
 *   ...
 *   return (<>{dialog}{/* page *​/}</>);
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      options={pending?.options ?? { title: "" }}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}
