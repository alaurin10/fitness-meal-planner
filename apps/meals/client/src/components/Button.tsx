import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-[#0a0c0f] font-semibold hover:opacity-90 active:opacity-80",
  secondary:
    "bg-surface2 text-text border border-border hover:border-accent/60",
  ghost: "bg-transparent text-muted hover:text-text",
};

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    />
  );
}
