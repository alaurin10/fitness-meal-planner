import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingLogin } from "./login.js";
import { _clearPending, putPending, takePending } from "./pendingLogins.js";

function fakePending(csrf = "csrf-1"): PendingLogin {
  return {
    cookies: { cookies: [] } as unknown as PendingLogin["cookies"],
    mfaCsrf: csrf,
    signinParams: { id: "gauth-widget" },
    consumer: { key: "ck", secret: "cs" },
  };
}

describe("pendingLogins store", () => {
  beforeEach(() => {
    _clearPending();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    _clearPending();
  });

  it("round-trips a pending login and consumes it once", () => {
    putPending("u1", fakePending("abc"));
    const first = takePending("u1");
    expect(first?.mfaCsrf).toBe("abc");
    // get-and-delete: a second take finds nothing.
    expect(takePending("u1")).toBeNull();
  });

  it("isolates users", () => {
    putPending("u1", fakePending("a"));
    putPending("u2", fakePending("b"));
    expect(takePending("u2")?.mfaCsrf).toBe("b");
    expect(takePending("u1")?.mfaCsrf).toBe("a");
  });

  it("replaces an earlier attempt for the same user", () => {
    putPending("u1", fakePending("old"));
    putPending("u1", fakePending("new"));
    expect(takePending("u1")?.mfaCsrf).toBe("new");
  });

  it("evicts entries older than the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00Z"));
    putPending("u1", fakePending());
    // Past the 5-minute TTL.
    vi.setSystemTime(new Date("2026-07-13T00:06:00Z"));
    expect(takePending("u1")).toBeNull();
  });

  it("returns a fresh entry within the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00Z"));
    putPending("u1", fakePending("fresh"));
    vi.setSystemTime(new Date("2026-07-13T00:04:00Z"));
    expect(takePending("u1")?.mfaCsrf).toBe("fresh");
  });
});
