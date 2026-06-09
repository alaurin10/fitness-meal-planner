import type { RequestHandler } from "express";
import { currentUserId } from "./auth.js";

/**
 * Lightweight per-user sliding-window rate limiter for expensive AI generation
 * endpoints. Guards against accidental double-submits and runaway cost.
 *
 * State is in-memory, so limits are per server instance — fine for the current
 * single-instance Railway deployment. If the API is ever scaled horizontally,
 * move this to a shared store (e.g. Redis).
 *
 * Must run AFTER requireAuth so the request carries a Clerk identity.
 */
export function rateLimit(opts: {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per user within the window. */
  max: number;
  /** Label used in the 429 message, e.g. "generation". */
  name?: string;
}): RequestHandler {
  const hits = new Map<string, number[]>();
  const label = opts.name ?? "request";
  let lastSweep = Date.now();

  return (req, res, next) => {
    let userId: string;
    try {
      userId = currentUserId(req);
    } catch {
      // If we can't identify the user, let the auth layer handle it.
      next();
      return;
    }

    const now = Date.now();

    // The per-request filter only prunes the active user's timestamps, so
    // users who stop making requests would otherwise linger in the map
    // forever. Sweep them out lazily at most once per window.
    if (now - lastSweep > opts.windowMs) {
      lastSweep = now;
      for (const [key, timestamps] of hits) {
        if (timestamps.every((t) => now - t >= opts.windowMs)) {
          hits.delete(key);
        }
      }
    }

    const recent = (hits.get(userId) ?? []).filter((t) => now - t < opts.windowMs);

    if (recent.length >= opts.max) {
      const retryMs = opts.windowMs - (now - (recent[0] ?? now));
      const retrySec = Math.max(1, Math.ceil(retryMs / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({
        error: `Too many ${label} requests. Please wait ${retrySec}s and try again.`,
      });
      return;
    }

    recent.push(now);
    hits.set(userId, recent);
    next();
  };
}
