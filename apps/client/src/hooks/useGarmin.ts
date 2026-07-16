import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  errors: string[];
}

export interface GarminPushDayResult {
  day: string;
  dayKey: string;
  workoutName: string;
  scheduled: boolean;
  error?: string;
}

const AUTO_SYNC_STALE_HOURS = 6;

// Queries whose data can change after a Garmin sync lands.
const SYNC_AFFECTED_KEYS = ["dailySummary", "history", "activities", "progress", "garmin"];

function invalidateSyncTargets(qc: ReturnType<typeof useQueryClient>) {
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
 * Kick off a background sync once per app load when the connection's data is
 * stale. The server's cooldown makes redundant calls harmless.
 */
export function useGarminAutoSync() {
  const status = useGarminStatus();
  const sync = useSyncGarmin();
  const fired = useRef(false);

  const connected = status.data?.connected ?? false;
  const lastSyncAt = status.data?.lastSyncAt;

  useEffect(() => {
    if (fired.current || !connected) return;
    const stale =
      !lastSyncAt ||
      Date.now() - new Date(lastSyncAt).getTime() > AUTO_SYNC_STALE_HOURS * 60 * 60 * 1000;
    if (!stale) return;
    fired.current = true;
    sync.mutate(undefined, { onError: () => {} }); // silent: surfaced via status card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, lastSyncAt]);
}
