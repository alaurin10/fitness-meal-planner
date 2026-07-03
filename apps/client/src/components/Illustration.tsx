import type { CSSProperties, ReactNode } from "react";

/**
 * Theme-aware inline SVG illustrations — the app's "imagery" layer.
 *
 * Drawing language (keep new scenes consistent):
 *  - Line work strokes `currentColor` (the svg defaults color to --ink so it
 *    flips with theme); width 1.75–2, round caps/joins — matches Icon.tsx.
 *  - Behind the lines: 2–3 soft duotone wash shapes filled with semantic
 *    color-mix washes (accent/moss/honey/clay). Never a literal hex.
 *  - Exactly one solid `var(--accent)` element per scene — the focal pop.
 * All scenes share a 160×120 viewBox; meal-* scenes keep a single centered
 * subject so they also read at thumbnail sizes.
 */

export type IllustrationName =
  | "no-plan"
  | "rest-day"
  | "empty-groceries"
  | "no-recipes"
  | "meals-done"
  | "workout-done"
  | "all-done"
  | "hydration"
  | "meal-breakfast"
  | "meal-lunch"
  | "meal-dinner"
  | "meal-snack"
  | "welcome";

const WASH_ACCENT = "var(--wash-accent-strong)";
const WASH_MOSS = "color-mix(in srgb, var(--moss) 18%, transparent)";
const WASH_HONEY = "color-mix(in srgb, var(--honey) 20%, transparent)";
const CLAY = "var(--clay)";
const ACCENT = "var(--accent)";
const ON_ACCENT = "var(--on-accent)";

function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill?: string }) {
  const d = `M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r} Z`;
  return fill ? <path d={d} fill={fill} stroke="none" /> : <path d={d} />;
}

const SCENES: Record<IllustrationName, ReactNode> = {
  /* Open planner waiting for its first week. */
  "no-plan": (
    <>
      <ellipse cx="80" cy="70" rx="54" ry="32" fill={WASH_ACCENT} stroke="none" />
      <ellipse cx="118" cy="42" rx="20" ry="14" fill={WASH_HONEY} stroke="none" />
      <path d="M80,40 C70,33 54,32 45,36 L45,82 C54,78 70,79 80,86 Z" fill="var(--paper)" />
      <path d="M80,40 C90,33 106,32 115,36 L115,82 C106,78 90,79 80,86 Z" fill="var(--paper)" />
      <path d="M80,40 L80,86" />
      <path d="M52,48 L72,46" strokeWidth="1.5" />
      <path d="M52,56 L72,54" strokeWidth="1.5" />
      <path d="M52,64 L66,63" strokeWidth="1.5" />
      <path d="M88,46 L108,48" strokeWidth="1.5" />
      <path d="M88,54 L108,56" strokeWidth="1.5" />
      <Sparkle x={122} y={26} r={7} fill={ACCENT} />
      <Sparkle x={38} y={34} r={4} />
    </>
  ),

  /* Crescent moon drifting over quiet hills. */
  "rest-day": (
    <>
      <circle cx="106" cy="38" r="24" fill={CLAY} stroke="none" />
      <path d="M8,98 Q46,62 88,98 Z" fill={WASH_MOSS} stroke="none" />
      <path d="M58,98 Q104,66 152,98 Z" fill={WASH_MOSS} stroke="none" />
      <path d="M14,95 Q46,66 84,94" />
      <path d="M64,95 Q104,70 148,96" />
      <path
        d="M112,22 A18,18 0 1 0 112,56 A14,14 0 1 1 112,22 Z"
        fill={ACCENT}
        stroke="none"
      />
      <path d="M46,26 h9 l-9,9 h9" strokeWidth="1.5" />
      <path d="M64,40 h6 l-6,6 h6" strokeWidth="1.25" />
    </>
  ),

  /* Woven basket, one leaf drifting in. */
  "empty-groceries": (
    <>
      <ellipse cx="80" cy="74" rx="52" ry="30" fill={WASH_HONEY} stroke="none" />
      <path d="M58,58 Q80,32 102,58" />
      <path d="M46,58 L114,58 L107,90 Q80,97 53,90 Z" fill="var(--paper)" />
      <path d="M60,60 L63,91" strokeWidth="1.5" />
      <path d="M73,60 L74,94" strokeWidth="1.5" />
      <path d="M87,60 L86,94" strokeWidth="1.5" />
      <path d="M100,60 L97,91" strokeWidth="1.5" />
      <path d="M49,72 Q80,80 111,72" strokeWidth="1.5" />
      <path
        d="M118,34 Q130,28 132,16 Q120,18 116,28 Q115,32 118,34 Z"
        fill={ACCENT}
        stroke="none"
      />
      <path d="M118,34 Q112,42 108,52" strokeWidth="1.5" />
    </>
  ),

  /* Cookbook with a fresh sprig on the page. */
  "no-recipes": (
    <>
      <ellipse cx="78" cy="68" rx="54" ry="32" fill={WASH_MOSS} stroke="none" />
      <path d="M80,38 C70,31 54,30 45,34 L45,82 C54,78 70,79 80,86 Z" fill="var(--paper)" />
      <path d="M80,38 C90,31 106,30 115,34 L115,82 C106,78 90,79 80,86 Z" fill="var(--paper)" />
      <path d="M80,38 L80,86" />
      <path d="M52,46 L72,44" strokeWidth="1.5" />
      <path d="M52,54 L68,53" strokeWidth="1.5" />
      <path d="M97,44 Q97,58 97,70" strokeWidth="1.5" />
      <path d="M97,52 Q90,48 88,42 Q95,42 97,48" fill={WASH_MOSS} strokeWidth="1.5" />
      <path d="M97,62 Q104,58 106,52 Q99,52 97,58" fill={WASH_MOSS} strokeWidth="1.5" />
      <path d="M97,44 Q94,38 96,33 Q101,36 99,42 Z" fill={ACCENT} stroke="none" />
      <path d="M58,30 Q59,26 62,24" strokeWidth="1.25" />
    </>
  ),

  /* Cleared plate, cutlery resting, day fueled. */
  "meals-done": (
    <>
      <ellipse cx="80" cy="66" rx="52" ry="32" fill={WASH_MOSS} stroke="none" />
      <circle cx="80" cy="64" r="29" fill="var(--paper)" />
      <circle cx="80" cy="64" r="19" strokeWidth="1.5" />
      <path d="M44,44 L44,84" />
      <path d="M40,44 L40,54 Q40,58 44,58 Q48,58 48,54 L48,44" strokeWidth="1.5" />
      <path d="M118,44 L118,84" />
      <path d="M118,44 Q124,52 122,62 L118,64" strokeWidth="1.5" />
      <circle cx="112" cy="34" r="11" fill={ACCENT} stroke="none" />
      <path d="M107,34 L110.5,37.5 L117,30.5" stroke={ON_ACCENT} strokeWidth="2" />
    </>
  ),

  /* Dumbbell under a small laurel — session in the books. */
  "workout-done": (
    <>
      <ellipse cx="80" cy="70" rx="54" ry="30" fill={WASH_ACCENT} stroke="none" />
      <path d="M50,50 Q64,36 80,34 Q96,36 110,50" strokeWidth="1.5" />
      <path d="M56,46 Q52,40 52,34 Q60,36 61,43" fill={WASH_MOSS} strokeWidth="1.25" />
      <path d="M68,39 Q66,32 68,26 Q75,30 73,37" fill={WASH_MOSS} strokeWidth="1.25" />
      <path d="M104,46 Q108,40 108,34 Q100,36 99,43" fill={WASH_MOSS} strokeWidth="1.25" />
      <path d="M92,39 Q94,32 92,26 Q85,30 87,37" fill={WASH_MOSS} strokeWidth="1.25" />
      <path d="M62,68 L98,68" strokeWidth="2" />
      <rect x="50" y="54" width="10" height="28" rx="4" fill={ACCENT} stroke="none" />
      <rect x="100" y="54" width="10" height="28" rx="4" fill={ACCENT} stroke="none" />
      <rect x="42" y="60" width="6" height="16" rx="3" fill="var(--paper)" />
      <rect x="112" y="60" width="6" height="16" rx="3" fill="var(--paper)" />
    </>
  ),

  /* Flag planted on the summit — everything complete. */
  "all-done": (
    <>
      <path d="M10,100 Q50,58 96,100 Z" fill={WASH_MOSS} stroke="none" />
      <path d="M70,100 Q112,70 152,100 Z" fill={WASH_MOSS} stroke="none" />
      <path d="M16,97 Q50,62 92,98" />
      <path d="M76,98 Q112,74 148,98" />
      <path d="M56,72 L56,30" />
      <path d="M56,30 L86,37 L56,44 Z" fill={ACCENT} stroke="none" />
      <Sparkle x={110} y={30} r={7} fill={WASH_HONEY} />
      <Sparkle x={126} y={48} r={4} />
      <Sparkle x={30} y={44} r={5} />
    </>
  ),

  /* Tall glass, wave settled, one drop to go. */
  hydration: (
    <>
      <ellipse cx="80" cy="68" rx="50" ry="32" fill={WASH_ACCENT} stroke="none" />
      <path d="M62,32 L98,32 L94,90 Q80,95 66,90 Z" fill="var(--paper)" />
      <path
        d="M64.5,56 Q72,51 80,56 Q88,61 95,56 L92.6,88 Q80,92.5 67.4,88 Z"
        fill={WASH_ACCENT}
        stroke="none"
      />
      <path d="M64.5,56 Q72,51 80,56 Q88,61 95,56" strokeWidth="1.5" />
      <circle cx="75" cy="70" r="2" strokeWidth="1.25" />
      <circle cx="85" cy="78" r="1.5" strokeWidth="1.25" />
      <path
        d="M112,22 Q118,30 118,35 A6,6 0 1 1 106,35 Q106,30 112,22 Z"
        fill={ACCENT}
        stroke="none"
      />
    </>
  ),

  /* Steaming bowl to start the day. */
  "meal-breakfast": (
    <>
      <circle cx="80" cy="62" r="42" fill={WASH_HONEY} stroke="none" />
      <path d="M50,58 Q50,90 80,90 Q110,90 110,58 Z" fill="var(--paper)" />
      <path d="M46,58 L114,58" />
      <path d="M70,48 Q65,41 70,34" strokeWidth="1.5" />
      <path d="M88,48 Q93,41 88,34" strokeWidth="1.5" />
      <path d="M66,74 Q80,80 94,74" strokeWidth="1.5" />
      <circle cx="98" cy="52" r="5" fill={ACCENT} stroke="none" />
    </>
  ),

  /* Stacked sandwich on a plate. */
  "meal-lunch": (
    <>
      <circle cx="80" cy="62" r="42" fill={WASH_MOSS} stroke="none" />
      <ellipse cx="80" cy="84" rx="38" ry="8" strokeWidth="1.5" />
      <path d="M54,60 Q54,46 68,46 L92,46 Q106,46 106,60 Z" fill="var(--paper)" />
      <path d="M52,64 Q58,58 66,64 Q74,70 80,64 Q86,58 94,64 Q102,70 108,64" fill={WASH_MOSS} strokeWidth="1.5" />
      <path d="M54,70 L106,70 Q106,80 94,80 L66,80 Q54,80 54,70 Z" fill="var(--paper)" />
      <circle cx="94" cy="40" r="6" fill={ACCENT} stroke="none" />
    </>
  ),

  /* Pan just off the heat. */
  "meal-dinner": (
    <>
      <circle cx="74" cy="62" r="42" fill={WASH_ACCENT} stroke="none" />
      <circle cx="74" cy="64" r="25" fill="var(--paper)" />
      <circle cx="74" cy="64" r="17" fill={WASH_HONEY} strokeWidth="1.5" />
      <path d="M99,60 L128,54" strokeWidth="2" />
      <path d="M66,44 Q62,37 66,30" strokeWidth="1.5" />
      <path d="M82,44 Q86,37 82,30" strokeWidth="1.5" />
      <circle cx="80" cy="60" r="5" fill={ACCENT} stroke="none" />
      <circle cx="67" cy="70" r="4" strokeWidth="1.5" />
    </>
  ),

  /* A good apple. */
  "meal-snack": (
    <>
      <circle cx="80" cy="64" r="42" fill={WASH_HONEY} stroke="none" />
      <path
        d="M80,46 C64,38 50,50 52,68 C54,84 66,94 80,92 C94,94 106,84 108,68 C110,50 96,38 80,46 Z"
        fill="var(--paper)"
      />
      <path d="M80,46 Q78,36 72,30" strokeWidth="1.5" />
      <path d="M80,40 Q90,28 100,30 Q96,42 84,44 Z" fill={ACCENT} stroke="none" />
      <path d="M64,60 Q60,66 62,74" strokeWidth="1.25" />
    </>
  ),

  /* Bowl + dumbbell + spark: the whole app in one frame. */
  welcome: (
    <>
      <ellipse cx="60" cy="66" rx="44" ry="30" fill={WASH_HONEY} stroke="none" />
      <ellipse cx="108" cy="72" rx="40" ry="26" fill={WASH_ACCENT} stroke="none" />
      <path d="M32,60 Q32,84 54,84 Q76,84 76,60 Z" fill="var(--paper)" />
      <path d="M28,60 L80,60" />
      <path d="M46,52 Q42,46 46,40" strokeWidth="1.5" />
      <path d="M60,52 Q64,46 60,40" strokeWidth="1.5" />
      <path d="M96,74 L124,74" strokeWidth="2" />
      <rect x="88" y="62" width="8" height="24" rx="3.5" fill={ACCENT} stroke="none" />
      <rect x="124" y="62" width="8" height="24" rx="3.5" fill={ACCENT} stroke="none" />
      <Sparkle x={92} y={34} r={8} fill={WASH_MOSS} />
      <Sparkle x={110} y={46} r={4} />
    </>
  ),
};

/** Scene for a meal slot — the app's stand-in for food photography. */
export function mealIllustration(slot?: string | null): IllustrationName {
  switch (slot) {
    case "breakfast":
      return "meal-breakfast";
    case "dinner":
      return "meal-dinner";
    case "snack":
      return "meal-snack";
    default:
      return "meal-lunch";
  }
}

export function Illustration({
  name,
  size = 140,
  className = "",
  style,
}: {
  name: IllustrationName;
  /** Rendered width in px; height follows the 4:3 viewBox. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      width={size}
      height={(size * 3) / 4}
      aria-hidden="true"
      role="presentation"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ color: "var(--ink)", display: "block", ...style }}
    >
      {SCENES[name]}
    </svg>
  );
}
