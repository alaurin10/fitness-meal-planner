export const ALL_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type DayLabel = (typeof ALL_DAYS)[number];
export type WeekStartDay = DayLabel;

const DAY_JS_MAP: Record<number, DayLabel> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

/**
 * Rotate the canonical Mon–Sun array so it begins at `weekStartDay`.
 * Example: rotateDays("Wed") => ["Wed","Thu","Fri","Sat","Sun","Mon","Tue"]
 */
export function rotateDays(weekStartDay: WeekStartDay): DayLabel[] {
  const idx = ALL_DAYS.indexOf(weekStartDay);
  return [...ALL_DAYS.slice(idx), ...ALL_DAYS.slice(0, idx)];
}

/**
 * 0-based index of `date` within a week that starts on `weekStartDay`.
 * E.g. if weekStartDay="Mon" and date is Wednesday => 2.
 */
export function dayIdxFromDate(
  date: Date,
  weekStartDay: WeekStartDay,
): number {
  const label = dayLabelFromDate(date);
  const rotated = rotateDays(weekStartDay);
  return rotated.indexOf(label);
}

/**
 * Canonical day label ("Mon"…"Sun") for a Date, independent of weekStartDay.
 */
export function dayLabelFromDate(date: Date): DayLabel {
  return DAY_JS_MAP[date.getDay()]!;
}

/**
 * Return the most recent date that falls on `weekStartDay`, at local 00:00.
 */
export function startOfWeek(date: Date, weekStartDay: WeekStartDay): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const target = ALL_DAYS.indexOf(weekStartDay);
  // Convert JS day (Sun=0) to our Mon=0 index, then compute offset
  const current = (copy.getDay() + 6) % 7; // Mon=0 … Sun=6
  const diff = (current - target + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

/**
 * Shift a date by N weeks (positive = forward, negative = back).
 */
export function addWeeks(date: Date, n: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

/**
 * YYYY-MM-DD in local time.
 */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a local-midnight Date.
 */
export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export interface PlanWindow {
  daysToInclude: DayLabel[];
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
}

/**
 * Compute which days a plan should cover for a given target week.
 *
 * - Current week, now > targetWeekStart: remainder days only (today onward).
 * - Current week, now === targetWeekStart (today is week-start): full 7 days.
 * - Future week: full 7 days.
 * - Past week: empty (callers should reject generation).
 */
export function computePlanWindow(
  targetWeekStart: Date,
  now: Date,
  weekStartDay: WeekStartDay,
): PlanWindow {
  const thisWeek = startOfWeek(now, weekStartDay);
  const rotated = rotateDays(weekStartDay);

  const targetTime = targetWeekStart.getTime();
  const thisTime = thisWeek.getTime();

  if (targetTime < thisTime) {
    return { daysToInclude: [], isCurrentWeek: false, isPastWeek: true, isFutureWeek: false };
  }

  if (targetTime > thisTime) {
    return { daysToInclude: [...rotated], isCurrentWeek: false, isPastWeek: false, isFutureWeek: true };
  }

  // Current week
  const todayIdx = dayIdxFromDate(now, weekStartDay);
  return {
    daysToInclude: rotated.slice(todayIdx),
    isCurrentWeek: true,
    isPastWeek: false,
    isFutureWeek: false,
  };
}

const EXERCISE_QUALIFIERS = [
  "barbell",
  "dumbbell",
  "db",
  "bb",
  "cable",
  "machine",
  "smith",
  "kettlebell",
  "kb",
  "bodyweight",
  "bw",
];

const EXERCISE_QUALIFIER_RE = new RegExp(
  `\\b(?:${EXERCISE_QUALIFIERS.join("|")})\\b`,
  "g",
);

/**
 * Normalize an exercise name for cross-plan matching so "Bench Press" and
 * "Barbell Bench Press" resolve to the same baseline key.
 * Must stay in sync with the SQL in the add_user_exercise_baseline migration.
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(EXERCISE_QUALIFIER_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * week.ts doubles as the package entry (see package.json "exports"), and the
 * package ships raw TypeScript that production Node loads via type stripping.
 * Type stripping does not rewrite relative ".js" specifiers to ".ts" files,
 * so this file must stay self-contained: define new exports inline below
 * rather than re-exporting sibling modules.
 */

/**
 * Parse a duration out of an exercise `reps` string, e.g. for timed/isometric
 * work ("45s", "hold 30s", "30-45 sec", "1 min", "0:30 hold", "45s per side").
 * Returns null for ordinary rep counts ("8-10", "5", "AMRAP", "max") so the
 * UI can decide between a countdown timer and a static reps label.
 */

export interface RepDuration {
  /** Timer length. For ranges the UPPER bound is the target. */
  seconds: number;
  /** True for unilateral holds ("per side", "each side", "30s/side"). */
  perSide: boolean;
}

const PER_SIDE_RE = /\b(?:per|each)\s+side\b|\/\s*side\b/;
// M:SS anywhere in the string, not preceded/followed by more digits ("0:30 hold").
const CLOCK_RE = /(?:^|[^\d:])(\d{1,3}):([0-5]\d)(?!\d)/;
// "<n>[ - <n>] <unit>" where unit is seconds (s/sec/secs/second/seconds) or
// minutes (m/min/mins/minute/minutes). The trailing \b keeps "10 steps" from
// matching ("s" followed by "t" is not a word boundary).
const UNIT_RE =
  /(\d+(?:\.\d+)?)\s*(?:(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*)?(s(?:ecs?|econds?)?|m(?:ins?|inutes?)?)\b/;

const MAX_SECONDS = 3600;

export function parseRepDuration(reps: string): RepDuration | null {
  const t = reps.trim().toLowerCase();
  if (!t) return null;
  const perSide = PER_SIDE_RE.test(t);

  const clock = t.match(CLOCK_RE);
  if (clock) {
    const seconds = parseInt(clock[1]!, 10) * 60 + parseInt(clock[2]!, 10);
    return validateRepDuration(seconds, perSide);
  }

  const unit = t.match(UNIT_RE);
  if (unit) {
    const value = parseFloat(unit[2] ?? unit[1]!); // range → upper bound
    const isMinutes = unit[3]!.startsWith("m");
    // A bare "m" ("500m row") is far more likely a distance than minutes;
    // only treat it as minutes for small, plausible values.
    if (unit[3] === "m" && value > 10) return null;
    const seconds = Math.round(isMinutes ? value * 60 : value);
    return validateRepDuration(seconds, perSide);
  }

  return null;
}

function validateRepDuration(
  seconds: number,
  perSide: boolean,
): RepDuration | null {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
    return null;
  }
  return { seconds, perSide };
}
