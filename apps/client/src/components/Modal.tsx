import type { CSSProperties, ReactNode } from "react";
import { Overlay } from "./Overlay";

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 420,
  zIndex,
  style,
  ...rest
}: {
  open: boolean;
  onClose: () => void;
  "aria-label": string;
  children: ReactNode;
  maxWidth?: number;
  zIndex?: number;
  style?: CSSProperties;
}) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      aria-label={rest["aria-label"]}
      align="center"
      zIndex={zIndex}
      panelClassName="modal-panel"
      panelStyle={{ maxWidth, ...style }}
    >
      {children}
    </Overlay>
  );
}
