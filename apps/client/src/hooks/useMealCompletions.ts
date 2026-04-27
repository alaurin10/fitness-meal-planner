import { useCallback, useEffect, useState } from "react";

/**
 * Tracks which meals the user has marked as eaten/complete for a given day.
 * Persisted in localStorage and keyed by the meal-plan id so completions
 * are scoped to the plan that produced them — regenerating the plan starts
 * fresh, and old plans don't pollute the active one.
 *
 * Old keys (other planIds) are pruned on mount.
 */

const STORAGE_KEY_PREFIX = "mealCompletions:v1:";
const MAX_KEEP_DAYS = 14;

function storageKey(planId: string, dayKey: string) {
  return `${STORAGE_KEY_PREFIX}${planId}:${dayKey}`;
}

function readSet(key: string): Set<number> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is number => typeof v === "number"));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<number>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // localStorage might be full or disabled — fail silently.
  }
}

/**
 * Local-date string in YYYY-MM-DD form. Uses the device's local time so
 * "today" always matches what the user perceives as today.
 */
export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useMealCompletions(
  planId: string | undefined,
  dayKey: string,
) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  // Load whenever the active key changes.
  useEffect(() => {
    if (!planId) {
      setCompleted(new Set());
      return;
    }
    setCompleted(readSet(storageKey(planId, dayKey)));
  }, [planId, dayKey]);

  // Sweep stale completion entries on mount — keep only entries whose
  // dayKey is within MAX_KEEP_DAYS of today.
  useEffect(() => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - MAX_KEEP_DAYS);
      const cutoffKey = localDayKey(cutoff);
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;
        // Key shape: prefix + planId + ':' + dayKey. Take the last 10 chars.
        const dk = key.slice(-10);
        if (dk < cutoffKey) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(
    (index: number) => {
      if (!planId) return;
      setCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        writeSet(storageKey(planId, dayKey), next);
        return next;
      });
    },
    [planId, dayKey],
  );

  const markComplete = useCallback(
    (index: number) => {
      if (!planId) return;
      setCompleted((prev) => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        writeSet(storageKey(planId, dayKey), next);
        return next;
      });
    },
    [planId, dayKey],
  );

  const isComplete = useCallback(
    (index: number) => completed.has(index),
    [completed],
  );

  return { completed, toggle, markComplete, isComplete };
}

/**
 * Read meal-completion indexes for a specific (planId, dayKey) without
 * subscribing. Used by views (e.g. WeekStrip) that need to peek at
 * past days and don't care about live updates.
 */
export function readMealCompletions(
  planId: string | undefined,
  dayKey: string,
): Set<number> {
  if (!planId) return new Set();
  return readSet(storageKey(planId, dayKey));
}
