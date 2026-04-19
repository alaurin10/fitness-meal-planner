import type { HTMLAttributes, ReactNode } from "react";

type Tone = "paper" | "clay" | "ink" | "gradient";

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  flush?: boolean;
  children?: ReactNode;
}

export function Card({
  tone = "paper",
  flush = false,
  className = "",
  children,
  ...rest
}: Props) {
  const toneClass =
    tone === "clay"
      ? "card card-clay"
      : tone === "ink"
        ? "card card-ink"
        : tone === "gradient"
          ? "card card-gradient"
          : "card";
  const flushClass = flush ? "!p-0 overflow-hidden" : "";
  return (
    <div {...rest} className={`${toneClass} ${flushClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
