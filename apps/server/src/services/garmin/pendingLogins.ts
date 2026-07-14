import type { PendingLogin } from "./login.js";

// In-memory store for the short-lived SSO session between the password step
// (`/connect`) and the MFA-code step (`/connect/mfa`). Garmin codes expire within
// a few minutes, so a process-local Map with a TTL is sufficient — the app-server
// runs as a single Railway instance (see railway.toml). If it is ever scaled to
// multiple replicas, swap this module for a shared store (DB/Redis); nothing else
// needs to change because PendingLogin is fully serializable.

const TTL_MS = 5 * 60 * 1000;

type Entry = { pending: PendingLogin; createdAt: number };
const store = new Map<string, Entry>();

function sweep(now: number): void {
  for (const [userId, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(userId);
  }
}

/** Stash a pending MFA login, replacing any earlier attempt for this user. */
export function putPending(userId: string, pending: PendingLogin): void {
  sweep(Date.now());
  store.set(userId, { pending, createdAt: Date.now() });
}

/**
 * Remove and return the pending login if it exists and hasn't expired.
 * Get-and-delete: a code is only ever consumed once.
 */
export function takePending(userId: string): PendingLogin | null {
  const now = Date.now();
  sweep(now);
  const entry = store.get(userId);
  if (!entry) return null;
  store.delete(userId);
  if (now - entry.createdAt > TTL_MS) return null;
  return entry.pending;
}

/** Test-only: drop all pending logins. */
export function _clearPending(): void {
  store.clear();
}
