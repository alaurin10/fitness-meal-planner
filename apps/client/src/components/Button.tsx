import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "plain";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className = "", ...rest },
  ref,
) {
  const variantClass =
    variant === "accent"
      ? "btn-accent"
      : variant === "ghost"
        ? "btn-ghost"
        : variant === "plain"
          ? "btn-plain"
          : "btn-primary";
  return <button ref={ref} {...rest} className={`btn ${variantClass} ${className}`} />;
});
