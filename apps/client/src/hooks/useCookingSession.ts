import { useCallback, useEffect, useState } from "react";

export interface CookingSession {
  stepIdx: number;
}

const STORAGE_KEY_PREFIX = "cookingSession:v1:";

function storageKey(sessionKey: string) {
  return `${STORAGE_KEY_PREFIX}${sessionKey}`;
}

function readSession(key: string): CookingSession | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.stepIdx === "number") {
      return { stepIdx: parsed.stepIdx };
    }
    return null;
  } catch {
    return null;
  }
}

function writeSession(key: string, session: CookingSession | null) {
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

/** Resume-position persistence for guided cooking, mirroring useWorkoutSession. */
export function useCookingSession(sessionKey: string) {
  const [session, setSession] = useState<CookingSession | null>(() => readSession(storageKey(sessionKey)));

  useEffect(() => {
    setSession(readSession(storageKey(sessionKey)));
  }, [sessionKey]);

  const saveSession = useCallback(
    (stepIdx: number) => {
      const next = { stepIdx };
      writeSession(storageKey(sessionKey), next);
      setSession(next);
    },
    [sessionKey],
  );

  const clearSession = useCallback(() => {
    writeSession(storageKey(sessionKey), null);
    setSession(null);
  }, [sessionKey]);

  return { session, saveSession, clearSession };
}
