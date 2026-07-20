import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { invalidateSyncTargets } from "./useGarmin";

// Live "doing this on my watch" session: poll the server until the saved
// Garmin strength activity for the day appears, at which point the server has
// already merged its sets into the day's WorkoutCompletion. Polling is gentle
// (75s) — the server additionally floors real Garmin calls at one per minute.

const POLL_MS = 75_000;
// Safety stop: nobody's session runs this long; prevents a forgotten tab from
// polling forever.
const MAX_SESSION_MS = 3 * 60 * 60 * 1000;

export interface WatchSessionActivity {
  activityId: string;
  activityName: string;
  durationMinutes: number | null;
  calories: number | null;
}

export type WatchSessionResponse =
  | { status: "waiting"; nextPollSeconds: number }
  | {
      status: "found";
      activity: WatchSessionActivity;
      matchedSets: number;
      totalPlannedSets: number;
      unmatchedSets: number;
      completion: { setsJson: Record<string, number[]>; completedAt: string | null };
    };

export function useWatchSession(planId: string | undefined, dayKey: string, enabled: boolean) {
  const api = useApi();
  const qc = useQueryClient();
  const startedAtRef = useRef(Date.now());
  const [found, setFound] = useState<Extract<WatchSessionResponse, { status: "found" }> | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["garmin", "watchSession", planId, dayKey],
    enabled: enabled && !!planId && !found,
    gcTime: 0, // a session is ephemeral — never serve a stale "found" on re-entry
    retry: false, // the poll loop itself is the retry
    refetchInterval: (q) => {
      if (q.state.data?.status === "found") return false;
      if (Date.now() - startedAtRef.current > MAX_SESSION_MS) return false;
      // A dead Garmin session can't recover on its own — stop hammering.
      if (isReconnectRequired(q.state.error)) return false;
      return POLL_MS;
    },
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const { data } = await api.post<WatchSessionResponse>("/api/garmin/watch-session/check", {
        planId,
        dayKey,
      });
      return data;
    },
  });

  // Latch the found result and refresh everything derived from completions —
  // the Workouts page's ring, dots, and button state all recompute from the
  // invalidated queries.
  const data = query.data;
  useEffect(() => {
    if (data?.status === "found" && !found) {
      setFound(data);
      qc.invalidateQueries({ queryKey: ["workoutCompletions", planId, dayKey] });
      invalidateSyncTargets(qc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return {
    found,
    /** Transient failure of the last poll (Garmin hiccup) — polling continues. */
    pollError: !found && query.isError && !isReconnectRequired(query.error) ? query.error : null,
    /** The Garmin link is dead; the user must reconnect in Settings. */
    reconnectRequired: isReconnectRequired(query.error),
    lastCheckedAt: query.dataUpdatedAt || null,
    isChecking: query.isFetching,
    startedAt: startedAtRef.current,
  };
}

function isReconnectRequired(err: unknown): boolean {
  const response = (
    err as { response?: { status?: number; data?: { reconnectRequired?: boolean } } } | null
  )?.response;
  return response?.status === 401 && response.data?.reconnectRequired === true;
}
