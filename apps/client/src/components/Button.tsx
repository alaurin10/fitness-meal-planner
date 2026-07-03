import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "plain";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
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
  const sizeClass = size === "lg" ? "btn-lg" : "";
  return (
    <button
      ref={ref}
      {...rest}
      className={`btn ${variantClass} ${sizeClass} press-spring ${className}`.trim()}
    />
  );
});
