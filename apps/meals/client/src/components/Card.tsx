import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
  children?: ReactNode;
}

export function Card({ accent = false, className = "", children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-surface border border-border rounded-md p-4 ${
        accent ? "border-l-[3px] border-l-accent" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
