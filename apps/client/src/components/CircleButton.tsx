import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 36 | 44;
  variant?: "outline" | "accent" | "soft" | "glass";
  "aria-label": string;
  children: ReactNode;
}

/**
 * Round action button for one-tap completions and steppers (hydration ±,
 * meal/ingredient checks, grocery rows). Unlike IconButton (passive chrome),
 * this is a primary touch target: springy press, 36px inline / 44px hero.
 */
export function CircleButton({
  size = 36,
  variant = "outline",
  children,
  style,
  className = "",
  ...rest
}: Props) {
  const variantStyle =
    variant === "accent"
      ? { border: "none", background: "var(--accent)", color: "var(--on-accent)" }
      : variant === "soft"
        ? { border: "none", background: "var(--clay)", color: "var(--sumi)" }
        : variant === "glass"
          ? { color: "var(--sumi)" }
          : {
              border: "1.5px solid var(--hair)",
              background: "var(--paper)",
              color: "var(--muted)",
            };
  return (
    <button
      type="button"
      className={`tappable press-spring ${variant === "glass" ? "glass" : ""} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        flexShrink: 0,
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
