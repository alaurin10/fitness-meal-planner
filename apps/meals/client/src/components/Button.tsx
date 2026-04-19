import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "plain";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: Props) {
  const variantClass =
    variant === "accent"
      ? "btn-accent"
      : variant === "ghost"
        ? "btn-ghost"
        : variant === "plain"
          ? "btn-plain"
          : "btn-primary";
  return <button {...rest} className={`btn ${variantClass} ${className}`} />;
}
