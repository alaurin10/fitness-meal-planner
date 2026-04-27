import { useCallback, useEffect, useState } from "react";
import { localDayKey } from "./useMealCompletions";

/**
 * Tracks whether the user has marked the day's workout as complete.
 * Persisted in localStorage, scoped to (workoutPlanId, dayKey) so
 * completions reset when a new plan is generated and naturally roll over
 * at local midnight. Stale entries (>14 days) are pruned on mount.
 */

const STORAGE_KEY_PREFIX = "workoutCompletions:v1:";
const MAX_KEEP_DAYS = 14;

function storageKey(planId: string, dayKey: string) {
  return `${STORAGE_KEY_PREFIX}${planId}:${dayKey}`;
}

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function useWorkoutCompletions(
  planId: string | undefined,
  dayKey: string,
) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!planId) {
      setIsComplete(false);
      return;
    }
    setIsComplete(readBool(storageKey(planId, dayKey)));
  }, [planId, dayKey]);

  // Sweep stale entries on mount.
  useEffect(() => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - MAX_KEEP_DAYS);
      const cutoffKey = localDayKey(cutoff);
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;
        const dk = key.slice(-10);
        if (dk < cutoffKey) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const markComplete = useCallback(() => {
    if (!planId) return;
    writeBool(storageKey(planId, dayKey), true);
    setIsComplete(true);
  }, [planId, dayKey]);

  const toggle = useCallback(() => {
    if (!planId) return;
    setIsComplete((prev) => {
      const next = !prev;
      writeBool(storageKey(planId, dayKey), next);
      return next;
    });
  }, [planId, dayKey]);

  return { isComplete, markComplete, toggle };
}
