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
    return validate(seconds, perSide);
  }

  const unit = t.match(UNIT_RE);
  if (unit) {
    const value = parseFloat(unit[2] ?? unit[1]!); // range → upper bound
    const isMinutes = unit[3]!.startsWith("m");
    // A bare "m" ("500m row") is far more likely a distance than minutes;
    // only treat it as minutes for small, plausible values.
    if (unit[3] === "m" && value > 10) return null;
    const seconds = Math.round(isMinutes ? value * 60 : value);
    return validate(seconds, perSide);
  }

  return null;
}

function validate(seconds: number, perSide: boolean): RepDuration | null {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
    return null;
  }
  return { seconds, perSide };
}
