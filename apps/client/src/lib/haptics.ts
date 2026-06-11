/**
 * Best-effort haptic feedback via the Vibration API.
 * No-ops where unsupported (iOS Safari) or when reduced motion is preferred.
 */

function vibrate(pattern: number | number[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate?.(pattern);
}

/** Light tick for toggles and taps. */
export function tap() {
  vibrate(10);
}

/** Slightly richer pulse for completions and successes. */
export function success() {
  vibrate([10, 40, 18]);
}
