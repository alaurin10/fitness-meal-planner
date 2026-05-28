import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// currentUserId normally reads the Clerk auth context; stub it to read req.userId.
vi.mock("./auth.js", () => ({
  currentUserId: (req: { userId?: string }) => {
    if (!req.userId) throw new Error("no user");
    return req.userId;
  },
}));

import { rateLimit } from "./rateLimit.js";

interface FakeRes {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  status: (code: number) => FakeRes;
  json: (b: unknown) => FakeRes;
  setHeader: (k: string, v: string) => void;
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
    setHeader(k, v) {
      res.headers[k] = v;
    },
  };
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(mw: ReturnType<typeof rateLimit>, userId?: string) {
  const req = { userId } as any;
  const res = makeRes();
  const next = vi.fn();
  mw(req, res as any, next as any);
  return { res, next };
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit then returns 429 with Retry-After", () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, name: "generation" });
    expect(run(mw, "u1").next).toHaveBeenCalledOnce();
    expect(run(mw, "u1").next).toHaveBeenCalledOnce();

    const third = run(mw, "u1");
    expect(third.next).not.toHaveBeenCalled();
    expect(third.res.statusCode).toBe(429);
    expect(third.res.headers["Retry-After"]).toBeDefined();
    expect(String((third.res.body as { error: string }).error)).toContain("generation");
  });

  it("tracks limits per user independently", () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    expect(run(mw, "a").next).toHaveBeenCalledOnce();
    expect(run(mw, "a").res.statusCode).toBe(429);
    // Different user is unaffected.
    expect(run(mw, "b").next).toHaveBeenCalledOnce();
  });

  it("allows requests again after the window elapses", () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1 });
    expect(run(mw, "u1").next).toHaveBeenCalledOnce();
    expect(run(mw, "u1").res.statusCode).toBe(429);

    vi.advanceTimersByTime(1_001);
    expect(run(mw, "u1").next).toHaveBeenCalledOnce();
  });

  it("passes through to next when the user can't be identified", () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1 });
    const { res, next } = run(mw, undefined);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeUndefined();
  });
});
