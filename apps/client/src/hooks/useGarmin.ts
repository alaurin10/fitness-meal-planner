import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useApi } from "../lib/api";

export interface GarminStatus {
  connected: boolean;
  garminUserId?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: "never" | "ok" | "error" | "syncing";
  lastSyncError?: string | null;
}

export interface GarminSyncResult {
  skipped?: "cooldown" | "already_syncing";
  wellnessDays: number;
  activitiesImported: number;
  weightsImported: number;
  setsSyncedActivities: number;
  errors: string[];
}

export interface GarminPushDayResult {
  day: string;
  dayKey: string;
  workoutName: string;
  scheduled: boolean;
  error?: string;
}

// How stale the last sync must be before an automatic sync attempt fires. Kept
// in step with the server's SYNC_COOLDOWN_MINUTES (15m): the server is the real
// guard and skips anything sooner, so mirroring it here avoids pointless calls.
const AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;
// Hard floor between two client-initiated attempts, whatever the trigger, so a
// burst of focus/visibility events can't fan out into repeated requests.
const AUTO_SYNC_ATTEMPT_THROTTLE_MS = 60 * 1000;

// Queries whose data can change after a Garmin sync lands.
const SYNC_AFFECTED_KEYS = ["dailySummary", "history", "activities", "progress", "garmin"];

export function invalidateSyncTargets(qc: ReturnType<typeof useQueryClient>) {
  for (const key of SYNC_AFFECTED_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useGarminStatus() {
  const api = useApi();
  return useQuery({
    queryKey: ["garmin", "status"],
    queryFn: async () => {
      const { data } = await api.get<GarminStatus>("/api/garmin/status");
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useConnectGarmin() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { username: string; password: string }) => {
      // Two-step verification accounts get `{ mfaRequired: true }` here and finish
      // via useSubmitGarminMfa; others link immediately with `{ connected: true }`.
      const { data } = await api.post<{
        connected?: boolean;
        mfaRequired?: boolean;
        garminUserId?: string | null;
      }>("/api/garmin/connect", input);
      return data;
    },
    onSuccess: (data) => {
      if (data.connected) invalidateSyncTargets(qc);
    },
  });
}

export function useSubmitGarminMfa() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const { data } = await api.post<{ connected: boolean; garminUserId?: string | null }>(
        "/api/garmin/connect/mfa",
        input,
      );
      return data;
    },
    onSuccess: () => invalidateSyncTargets(qc),
  });
}

/**
 * Fallback link path: paste the token JSON produced by running the export
 * script on your own computer (used when Garmin rate-limits sign-ins coming
 * from the server's shared hosting IP).
 */
export function useImportGarminTokens() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tokens: string }) => {
      const { data } = await api.post<{ connected: boolean; garminUserId?: string | null }>(
        "/api/garmin/connect/import",
        input,
      );
      return data;
    },
    onSuccess: () => invalidateSyncTargets(qc),
  });
}

export function useDisconnectGarmin() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete("/api/garmin/connection");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garmin"] });
    },
  });
}

export function useSyncGarmin() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { force?: boolean }) => {
      const { data } = await api.post<GarminSyncResult>("/api/garmin/sync", input ?? {});
      return data;
    },
    onSuccess: () => invalidateSyncTargets(qc),
  });
}

export function usePushWeekToGarmin() {
  const api = useApi();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data } = await api.post<{ days: GarminPushDayResult[] }>("/api/garmin/push-week", {
        planId,
      });
      return data.days;
    },
  });
}

/**
 * Keep Garmin data fresh without the user pressing "Sync now". While the app is
 * open this attempts a background sync on three triggers:
 *   1. initial mount (and whenever the connection first becomes stale),
 *   2. a periodic timer, and
 *   3. the app becoming active again — returning to the tab or foregrounding
 *      the app (visibilitychange / window focus).
 * Each attempt is skipped unless the last sync is stale, and a short throttle
 * collapses bursts of focus events. The server's cooldown is the real guard, so
 * any redundant call it receives is cheaply skipped. Silent by design — results
 * and errors surface through the Garmin status card.
 */
export function useGarminAutoSync() {
  const status = useGarminStatus();
  const sync = useSyncGarmin();
  const lastAttemptRef = useRef(0);

  const connected = status.data?.connected ?? false;
  const lastSyncAt = status.data?.lastSyncAt;

  // Mirror the latest state into a ref so the stable event handlers below can
  // read it without re-subscribing on every status refresh.
  const stateRef = useRef({ connected, lastSyncAt, pending: sync.isPending });
  stateRef.current = { connected, lastSyncAt, pending: sync.isPending };

  const maybeSync = useCallback(() => {
    const { connected, lastSyncAt, pending } = stateRef.current;
    if (!connected || pending) return;
    const now = Date.now();
    if (now - lastAttemptRef.current < AUTO_SYNC_ATTEMPT_THROTTLE_MS) return;
    const fresh =
      lastSyncAt != null && now - new Date(lastSyncAt).getTime() < AUTO_SYNC_MIN_INTERVAL_MS;
    if (fresh) return;
    lastAttemptRef.current = now;
    sync.mutate(undefined, { onError: () => {} });
    // sync.mutate is referentially stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire on mount and whenever a status change (connected / last sync) makes a
  // sync newly due.
  useEffect(() => {
    maybeSync();
  }, [connected, lastSyncAt, maybeSync]);

  // Periodic re-sync while the app stays open.
  useEffect(() => {
    const id = window.setInterval(maybeSync, AUTO_SYNC_MIN_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [maybeSync]);

  // Re-sync when the app becomes active again after being backgrounded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") maybeSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", maybeSync);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", maybeSync);
    };
  }, [maybeSync]);
}
