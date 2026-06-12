import { useEffect, useSyncExternalStore } from "react";

/**
 * Theme handling. The inline script in index.html applies the stored
 * preference before first paint; this module keeps the attributes, the
 * theme-color meta, and React state in sync afterwards.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type Palette = "earthy" | "carbon";

const THEME_KEY = "theme";
const PALETTE_KEY = "palette";

// Keep in sync with the palette bg tokens in styles/tokens.css.
const THEME_COLOR: Record<Palette, Record<ResolvedTheme, string>> = {
  earthy: { light: "#F4EADB", dark: "#1A1410" },
  carbon: { light: "#F4F5F7", dark: "#0E0F11" },
};

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function getPalette(): Palette {
  return localStorage.getItem(PALETTE_KEY) === "carbon" ? "carbon" : "earthy";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply() {
  const palette = getPalette();
  const resolved = resolveTheme(getThemePreference());
  const root = document.documentElement;
  root.setAttribute("data-palette", palette);
  root.setAttribute("data-theme", resolved);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[palette][resolved]);
}

// Crossfade colors on explicit user toggles only (styles in tokens.css).
// Never used for the system listener or server sync — a background change
// shortly after load animating the whole page would read as a glitch.
let crossfadeTimer: number | undefined;
function animateThemeChange() {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  window.clearTimeout(crossfadeTimer);
  crossfadeTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 240);
}

export function setThemePreference(pref: ThemePreference, opts?: { animate?: boolean }) {
  if (opts?.animate) animateThemeChange();
  localStorage.setItem(THEME_KEY, pref);
  apply();
  emit();
}

export function setPalette(palette: Palette, opts?: { animate?: boolean }) {
  if (opts?.animate) animateThemeChange();
  localStorage.setItem(PALETTE_KEY, palette);
  apply();
  emit();
}

// Follow OS-level changes while preference is "system".
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "system") {
      apply();
      emit();
    }
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getThemePreference);
  const palette = useSyncExternalStore(subscribe, getPalette);
  const resolved = useSyncExternalStore(subscribe, () => resolveTheme(getThemePreference()));

  return {
    preference,
    palette,
    resolved,
    setPreference: setThemePreference,
    setPalette,
  };
}

/**
 * One-way sync from server settings: when the server-stored theme differs
 * from the local preference (e.g. changed on another device), server wins.
 */
export function useSyncServerTheme(serverTheme: string | undefined) {
  useEffect(() => {
    if (serverTheme !== "light" && serverTheme !== "dark" && serverTheme !== "system") return;
    if (serverTheme !== getThemePreference()) {
      setThemePreference(serverTheme);
    }
  }, [serverTheme]);
}
