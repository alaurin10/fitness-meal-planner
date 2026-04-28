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
