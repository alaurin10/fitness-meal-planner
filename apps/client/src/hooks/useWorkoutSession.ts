import { useCallback, useEffect, useState } from "react";
import { localDayKey } from "./useMealCompletions";
import type { Exercise } from "./useWorkoutPlan";

export interface WorkoutSession {
  exerciseIdx: number;
  setNum: number;
}

const STORAGE_KEY_PREFIX = "workoutSession:v1:";
const MAX_KEEP_DAYS = 14;

function storageKey(planId: string, dayKey: string) {
  return `${STORAGE_KEY_PREFIX}${planId}:${dayKey}`;
}

function readSession(key: string): WorkoutSession | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.exerciseIdx === "number" &&
      typeof parsed.setNum === "number"
    ) {
      return { exerciseIdx: parsed.exerciseIdx, setNum: parsed.setNum };
    }
    return null;
  } catch {
    return null;
  }
}

function writeSession(key: string, session: WorkoutSession | null) {
  try {
    if (session) {
      window.localStorage.setItem(key, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * Compute how many sets have been completed based on the saved session
 * position.  Returns `{ completed, total, fraction }`.
 */
export function sessionProgress(
  session: WorkoutSession | null,
  exercises: Exercise[],
) {
  const total = exercises.reduce((s, e) => s + e.sets, 0);
  if (!session || total === 0) return { completed: 0, total, fraction: 0 };
  const completed =
    exercises.slice(0, session.exerciseIdx).reduce((s, e) => s + e.sets, 0) +
    (session.setNum - 1);
  return { completed, total, fraction: completed / total };
}

export function useWorkoutSession(
  planId: string | undefined,
  dayKey: string,
) {
  const [session, setSession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    if (!planId) {
      setSession(null);
      return;
    }
    setSession(readSession(storageKey(planId, dayKey)));
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

  const saveSession = useCallback(
    (exerciseIdx: number, setNum: number) => {
      if (!planId) return;
      const next = { exerciseIdx, setNum };
      writeSession(storageKey(planId, dayKey), next);
      setSession(next);
    },
    [planId, dayKey],
  );

  const clearSession = useCallback(() => {
    if (!planId) return;
    writeSession(storageKey(planId, dayKey), null);
    setSession(null);
  }, [planId, dayKey]);

  return { session, saveSession, clearSession };
}
