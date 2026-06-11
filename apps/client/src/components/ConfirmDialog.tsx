import { useCallback, useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

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
  return (
    <Sheet open={open} onClose={onCancel} aria-label={options.title}>
      <div className="font-display" style={{ fontSize: 20, color: "var(--ink)", paddingTop: 6 }}>
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
          variant={options.destructive ? "accent" : "primary"}
          className="flex-1"
          onClick={onConfirm}
        >
          {options.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </Sheet>
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
