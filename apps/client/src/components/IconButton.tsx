import type { ButtonHTMLAttributes, ReactNode } from "react";

const SIZES = { 28: 28, 32: 32, 36: 36, 44: 44 } as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: keyof typeof SIZES;
  variant?: "ghost" | "outline" | "solid" | "glass";
  "aria-label": string;
  children: ReactNode;
}

/** Circular icon-only button — the inline pattern repeated across pages. */
export function IconButton({
  size = 36,
  variant = "outline",
  children,
  style,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`tappable ${variant === "glass" ? "glass" : ""} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: variant === "outline" ? "1px solid var(--hair)" : undefined,
        background:
          variant === "solid" ? "var(--clay)" : variant === "glass" ? undefined : "transparent",
        color: "var(--sumi)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
