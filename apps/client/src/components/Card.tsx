import type { HTMLAttributes, ReactNode } from "react";

type Tone = "paper" | "clay" | "ink" | "gradient" | "hero" | "glass" | "accent";

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  flush?: boolean;
  /** Elevate one shadow tier above the resting card. */
  raised?: boolean;
  /** Hover lift + press feedback for cards that act as links/buttons. */
  interactive?: boolean;
  children?: ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
  paper: "card",
  clay: "card card-clay",
  ink: "card card-ink",
  gradient: "card card-gradient",
  hero: "card card-hero",
  glass: "card card-glass glass",
  accent: "card card-accent",
};

export function Card({
  tone = "paper",
  flush = false,
  raised = false,
  interactive = false,
  className = "",
  children,
  ...rest
}: Props) {
  const classes = [
    TONE_CLASS[tone],
    raised ? "card-raised" : "",
    interactive ? "card-lift tappable" : "",
    flush ? "!p-0 overflow-hidden" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
}
