import confetti from "canvas-confetti";

/**
 * Fire a burst of confetti to celebrate completing all daily goals.
 * Safe to call multiple times — subsequent calls within 2s are debounced.
 */
let lastFired = 0;

export function fireCelebration() {
  const now = Date.now();
  if (now - lastFired < 2000) return;
  lastFired = now;

  const count = 120;
  const defaults = {
    origin: { y: 0.65 },
    zIndex: 9999,
    disableForReducedMotion: true,
  };

  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.4),
    spread: 55,
    startVelocity: 40,
    scalar: 1.1,
    colors: ["#C77D4F", "#5C6B4F", "#C79A4B", "#B5615E"],
  });

  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.3),
    spread: 80,
    startVelocity: 30,
    decay: 0.92,
    scalar: 0.9,
    colors: ["#C77D4F", "#5C6B4F", "#C79A4B"],
  });

  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.3),
      spread: 100,
      startVelocity: 25,
      decay: 0.94,
      scalar: 0.8,
      colors: ["#C77D4F", "#C79A4B"],
    });
  }, 150);
}
