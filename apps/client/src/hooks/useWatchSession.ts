import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { invalidateSyncTargets } from "./useGarmin";

// "Doing this on my watch" session: the user works out from their watch and
// taps Finish when done. That fires ONE check — Garmin only exposes the
// activity after it's saved and synced, so there's nothing to poll for
// between now and then. On a hit, the server has already merged the recorded
// sets into the day's WorkoutCompletion.

export interface WatchSessionActivity {
  activityId: string;
  activityName: string;
  durationMinutes: number | null;
  calories: number | null;
}

export type WatchSessionResponse =
  | { status: "waiting" }
  | {
      status: "found";
      activity: WatchSessionActivity;
      matchedSets: number;
      totalPlannedSets: number;
      unmatchedSets: number;
      completion: { setsJson: Record<string, number[]>; completedAt: string | null };
    };

export type WatchSessionStatus = "idle" | "checking" | "notFound" | "found" | "reconnect";

export function useWatchSession(planId: string | undefined, dayKey: string) {
  const api = useApi();
  const qc = useQueryClient();
  const [found, setFound] = useState<Extract<WatchSessionResponse, { status: "found" }> | null>(
    null,
  );
  const [notFound, setNotFound] = useState(false);
  const [reconnect, setReconnect] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<WatchSessionResponse>("/api/garmin/watch-session/check", {
        planId,
        dayKey,
      });
      return data;
    },
    onMutate: () => {
      setNotFound(false);
    },
    onSuccess: (data) => {
      if (data.status === "found") {
        setFound(data);
        // Seed + refresh everything derived from completions so the Workouts
        // page's ring, dots, and button state recompute immediately.
        qc.invalidateQueries({ queryKey: ["workoutCompletions", planId, dayKey] });
        invalidateSyncTargets(qc);
      } else {
        setNotFound(true);
      }
    },
    onError: (err) => {
      if (isReconnectRequired(err)) setReconnect(true);
    },
  });

  const status: WatchSessionStatus = found
    ? "found"
    : reconnect
      ? "reconnect"
      : mutation.isPending
        ? "checking"
        : notFound
          ? "notFound"
          : "idle";

  return {
    status,
    found,
    check: () => {
      if (planId) mutation.mutate();
    },
  };
}

function isReconnectRequired(err: unknown): boolean {
  const response = (
    err as { response?: { status?: number; data?: { reconnectRequired?: boolean } } } | null
  )?.response;
  return response?.status === 401 && response.data?.reconnectRequired === true;
}
