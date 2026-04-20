import type { CSSProperties } from "react";

export type IconName =
  | "home"
  | "plan"
  | "progress"
  | "profile"
  | "groceries"
  | "dumbbell"
  | "leaf"
  | "flame"
  | "check"
  | "plus"
  | "chevron"
  | "chevron-down"
  | "sparkle"
  | "sun"
  | "moon"
  | "settings"
  | "water"
  | "timer"
  | "heart"
  | "scale"
  | "note"
  | "x"
  | "swap"
  | "share"
  | "fork"
  | "ellipsis";

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 20, stroke = 1.75, style, className }: Props) {
  const s: CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    ...style,
  };
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" />
        </svg>
      );
    case "plan":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <rect {...common} x="3.5" y="5" width="17" height="15" rx="2" />
          <path {...common} d="M3.5 9.5h17M8 3v4M16 3v4" />
        </svg>
      );
    case "progress":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M4 19l5-5 3 3 8-8" />
          <path {...common} d="M14 9h6v6" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <circle {...common} cx="12" cy="8" r="3.5" />
          <path {...common} d="M4.5 20c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5" />
        </svg>
      );
    case "groceries":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M4 6h2l1.5 10.5A2 2 0 009.5 18h8.2a2 2 0 002-1.6L21 9H7" />
          <circle {...common} cx="10" cy="21" r="1.2" />
          <circle {...common} cx="17" cy="21" r="1.2" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M3 10v4M6 7v10M9 10v4h6v-4zM18 7v10M21 10v4" />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M4 20c0-9 7-16 17-16-1 9-7 16-17 16z" />
          <path {...common} d="M4 20c3-6 7-10 14-12" />
        </svg>
      );
    case "flame":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M5 12.5L10 17.5l9-10" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M12 5v14M5 12h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M9 6l6 6-6 6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M6 9l6 6 6-6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path
            {...common}
            d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"
          />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <circle {...common} cx="12" cy="12" r="4" />
          <path
            {...common}
            d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"
          />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M20 14a8 8 0 01-10-10 8 8 0 1010 10z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <circle {...common} cx="12" cy="12" r="3" />
          <path
            {...common}
            d="M19.4 14a1.8 1.8 0 00.3 2l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.8 1.8 0 00-2-.4 1.8 1.8 0 00-1.1 1.7V20a2 2 0 01-4 0v-.1a1.8 1.8 0 00-1.2-1.7 1.8 1.8 0 00-2 .4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.8 1.8 0 00.4-2 1.8 1.8 0 00-1.7-1.2H4a2 2 0 010-4h.1a1.8 1.8 0 001.7-1.2 1.8 1.8 0 00-.4-2l-.1-.1a2 2 0 012.8-2.8l.1.1a1.8 1.8 0 002 .4H10a1.8 1.8 0 001.1-1.7V4a2 2 0 014 0v.1a1.8 1.8 0 001.1 1.7 1.8 1.8 0 002-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.8 1.8 0 00-.4 2V10a1.8 1.8 0 001.7 1.1H20a2 2 0 010 4h-.1a1.8 1.8 0 00-1.7 1.1z"
          />
        </svg>
      );
    case "water":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M12 3c4 5 7 8 7 12a7 7 0 11-14 0c0-4 3-7 7-12z" />
        </svg>
      );
    case "timer":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <circle {...common} cx="12" cy="13" r="8" />
          <path {...common} d="M12 13V9M9 3h6" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path
            {...common}
            d="M12 20s-7-4.5-9-9.5C1.5 6 5 3 8 4.5c1.6.8 3 2.5 4 4 1-1.5 2.4-3.2 4-4 3-1.5 6.5 1.5 5 6-2 5-9 9.5-9 9.5z"
          />
        </svg>
      );
    case "scale":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <rect {...common} x="3" y="5" width="18" height="15" rx="3" />
          <circle {...common} cx="12" cy="11" r="2.5" />
          <path {...common} d="M12 8.5V5" />
        </svg>
      );
    case "note":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M5 4h10l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path {...common} d="M15 4v4h4M8 13h8M8 16h5" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "swap":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M7 7h13l-3-3M17 17H4l3 3" />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M12 3v13M8 7l4-4 4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" />
        </svg>
      );
    case "fork":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <path {...common} d="M7 3v6a3 3 0 003 3M17 3v6a3 3 0 01-3 3M12 12v9M5 3v3M19 3v3" />
        </svg>
      );
    case "ellipsis":
      return (
        <svg viewBox="0 0 24 24" style={s} className={className}>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}
