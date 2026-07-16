import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock only the impit HTTP transport; oauth-1.0a and tough-cookie run for real
// so signing and the cookie jar are genuinely exercised. Responses use the real
// Fetch `Headers` class so getSetCookie()/get() behave exactly as in production.
const mocks = vi.hoisted(() => {
  const fetch = vi.fn();
  const construct = vi.fn();
  return { fetch, construct };
});

vi.mock("impit", () => ({
  Impit: class {
    fetch = mocks.fetch;
    constructor(options: unknown) {
      mocks.construct(options);
    }
  },
}));

import { resumeGarminLogin, startGarminLogin, type PendingLogin } from "./login.js";
import { GarminAuthError, GarminUnavailableError } from "./types.js";

const SIGNIN_PAGE = `<html><body><form>
  <input type="hidden" name="_csrf" value="CSRF-signin"/>
</form></body></html>`;

const TICKET_PAGE = `<html><body>
  <script>response_url = "https://sso.garmin.com/sso/embed?ticket=ST-42-xyz";</script>
</body></html>`;

const MFA_PAGE = `<html><head><title>MFA</title></head><body>
  <form action="/sso/verifyMFA/loginEnterMfaCode">
    <input type="hidden" name="_csrf" value="CSRF-mfa"/>
    <input name="mfa-code"/>
  </form></body></html>`;

const OAUTH1_BODY = "oauth_token=OT-1&oauth_token_secret=OTS-1&mfa_token=&mfa_expiration_timestamp=";
const OAUTH2_JSON = JSON.stringify({
  scope: "CONNECT_READ",
  jti: "jti-1",
  access_token: "AT-1",
  token_type: "Bearer",
  refresh_token: "RT-1",
  expires_in: 3600,
  refresh_token_expires_in: 7776000,
});

// Build a fetch-style Response stub the way impit returns one.
function resp(
  status: number,
  opts: { setCookie?: string[]; location?: string; retryAfter?: string; body?: string; json?: unknown } = {},
) {
  const headers = new Headers();
  for (const c of opts.setCookie ?? []) headers.append("set-cookie", c);
  if (opts.location) headers.set("location", opts.location);
  if (opts.retryAfter) headers.set("retry-after", opts.retryAfter);
  return {
    status,
    headers,
    text: async () => opts.body ?? "",
    json: async () => opts.json ?? {},
  };
}

// Route a mocked request by URL + method. `signinPost` decides step-2 outcome.
function router(signinPost: string) {
  return (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
    const method = init?.method ?? "GET";
    if (url.includes("oauth_consumer.json")) {
      return Promise.resolve(resp(200, { json: { consumer_key: "ck", consumer_secret: "cs" } }));
    }
    if (url.includes("/sso/embed") && method === "GET") {
      return Promise.resolve(resp(200, { setCookie: ["GARMIN-SSO-GUID=g1; Path=/"] }));
    }
    if (url.includes("/sso/signin") && method === "GET") {
      return Promise.resolve(resp(200, { setCookie: ["SESSIONID=s1; Path=/"], body: SIGNIN_PAGE }));
    }
    if (url.includes("/sso/signin") && method === "POST") {
      return Promise.resolve(resp(200, { body: signinPost }));
    }
    if (url.includes("/sso/verifyMFA") && method === "POST") {
      return Promise.resolve(resp(200, { body: TICKET_PAGE }));
    }
    if (url.includes("/oauth-service/oauth/preauthorized") && method === "GET") {
      // Capture that this call was OAuth1-signed.
      expect(init?.headers?.Authorization).toMatch(/^OAuth /);
      return Promise.resolve(resp(200, { body: OAUTH1_BODY }));
    }
    if (url.includes("/oauth-service/oauth/exchange") && method === "POST") {
      return Promise.resolve(resp(200, { body: OAUTH2_JSON }));
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  };
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.construct.mockReset();
});

describe("startGarminLogin", () => {
  it("impersonates Chrome and follows redirects manually", async () => {
    mocks.fetch.mockImplementation(router(TICKET_PAGE));

    await startGarminLogin("user@example.com", "pw");

    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({ browser: "chrome", followRedirects: false }),
    );
  });

  it("completes without MFA and returns garmin-connect-shaped tokens", async () => {
    mocks.fetch.mockImplementation(router(TICKET_PAGE));

    const result = await startGarminLogin("user@example.com", "pw");

    expect(result.status).toBe("complete");
    if (result.status !== "complete") throw new Error("unreachable");
    expect(result.tokens.oauth1).toEqual({ oauth_token: "OT-1", oauth_token_secret: "OTS-1" });
    expect(result.tokens.oauth2.access_token).toBe("AT-1");
    expect(result.tokens.oauth2.refresh_token).toBe("RT-1");
    // Derived expiry fields garmin-connect's refresh logic relies on.
    expect(result.tokens.oauth2.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(result.tokens.oauth2.refresh_token_expires_at).toBeGreaterThan(
      result.tokens.oauth2.expires_at,
    );
  });

  it("returns mfa_required with serializable pending state when 2FA is on", async () => {
    mocks.fetch.mockImplementation(router(MFA_PAGE));

    const result = await startGarminLogin("user@example.com", "pw");

    expect(result.status).toBe("mfa_required");
    if (result.status !== "mfa_required") throw new Error("unreachable");
    expect(result.pending.mfaCsrf).toBe("CSRF-mfa");
    expect(result.pending.consumer).toEqual({ key: "ck", secret: "cs" });
    // Pending state must survive JSON round-trip (it is held in-memory / could be persisted).
    expect(() => JSON.parse(JSON.stringify(result.pending))).not.toThrow();
    expect(result.pending.cookies.cookies.length).toBeGreaterThan(0);
  });

  it("throws GarminUnavailableError when the CSRF token is missing", async () => {
    mocks.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (url.includes("oauth_consumer.json")) {
        return Promise.resolve(resp(200, { json: { consumer_key: "ck", consumer_secret: "cs" } }));
      }
      if (url.includes("/sso/signin") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(resp(200, { body: "<html>no csrf here</html>" }));
      }
      return Promise.resolve(resp(200, { body: "" }));
    });

    await expect(startGarminLogin("u", "p")).rejects.toBeInstanceOf(GarminUnavailableError);
  });

  it("throws GarminAuthError on bad credentials (no ticket, no MFA)", async () => {
    mocks.fetch.mockImplementation(router("<html><body>Invalid</body></html>"));

    await expect(startGarminLogin("u", "p")).rejects.toBeInstanceOf(GarminAuthError);
  });
});

describe("resumeGarminLogin", () => {
  it("submits the code, exchanges the ticket, and returns tokens", async () => {
    mocks.fetch.mockImplementation(router(MFA_PAGE));
    const started = await startGarminLogin("u", "p");
    if (started.status !== "mfa_required") throw new Error("expected mfa_required");

    const { tokens } = await resumeGarminLogin(started.pending, "123456");

    expect(tokens.oauth1.oauth_token).toBe("OT-1");
    expect(tokens.oauth2.access_token).toBe("AT-1");
  });

  it("throws GarminAuthError when the code is rejected (no ticket returned)", async () => {
    const pending: PendingLogin = {
      cookies: { version: "tough-cookie@6", storeType: "MemoryCookieStore", rejectPublicSuffixes: true, enableLooseMode: false, allowSpecialUseDomain: true, prefixSecurity: "silent", cookies: [] } as unknown as PendingLogin["cookies"],
      mfaCsrf: "CSRF-mfa",
      signinParams: { id: "gauth-widget" },
      consumer: { key: "ck", secret: "cs" },
    };
    mocks.fetch.mockImplementation((url: string) => {
      if (url.includes("/sso/verifyMFA")) {
        return Promise.resolve(resp(200, { body: "<html>wrong code</html>" }));
      }
      throw new Error(`unexpected ${url}`);
    });

    await expect(resumeGarminLogin(pending, "000000")).rejects.toBeInstanceOf(GarminAuthError);
  });
});

describe("429 rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function baseRoute(url: string, method: string) {
    if (url.includes("oauth_consumer.json")) {
      return resp(200, { json: { consumer_key: "ck", consumer_secret: "cs" } });
    }
    if (url.includes("/sso/embed") && method === "GET") {
      return resp(200, { setCookie: ["GARMIN-SSO-GUID=g1; Path=/"] });
    }
    if (url.includes("/sso/signin") && method === "GET") {
      return resp(200, { setCookie: ["SESSIONID=s1; Path=/"], body: SIGNIN_PAGE });
    }
    if (url.includes("/sso/signin") && method === "POST") {
      return resp(200, { body: TICKET_PAGE });
    }
    return null;
  }

  it("retries a transient 429 on the preauthorized call and succeeds", async () => {
    let preauthAttempts = 0;
    mocks.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      const base = baseRoute(url, method);
      if (base) return Promise.resolve(base);
      if (url.includes("/oauth-service/oauth/preauthorized") && method === "GET") {
        preauthAttempts += 1;
        if (preauthAttempts === 1) return Promise.resolve(resp(429, { body: "Rate limited" }));
        return Promise.resolve(resp(200, { body: OAUTH1_BODY }));
      }
      if (url.includes("/oauth-service/oauth/exchange") && method === "POST") {
        return Promise.resolve(resp(200, { body: OAUTH2_JSON }));
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    });

    const promise = startGarminLogin("user@example.com", "pw");
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result.status).toBe("complete");
    expect(preauthAttempts).toBe(2);
  });

  it("surfaces a clear rate-limit error once retries are exhausted", async () => {
    let preauthAttempts = 0;
    mocks.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      const base = baseRoute(url, method);
      if (base) return Promise.resolve(base);
      if (url.includes("/oauth-service/oauth/preauthorized") && method === "GET") {
        preauthAttempts += 1;
        return Promise.resolve(resp(429, { body: "Rate limited" }));
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    });

    const promise = startGarminLogin("user@example.com", "pw");
    const rejection = expect(promise).rejects.toThrow(/rate-limiting/i);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;

    // Initial attempt + MAX_429_RETRIES retries, then give up.
    expect(preauthAttempts).toBe(4);
  });

  it("honors a Retry-After header instead of the default backoff", async () => {
    let preauthAttempts = 0;
    mocks.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      const base = baseRoute(url, method);
      if (base) return Promise.resolve(base);
      if (url.includes("/oauth-service/oauth/preauthorized") && method === "GET") {
        preauthAttempts += 1;
        if (preauthAttempts === 1) {
          return Promise.resolve(resp(429, { retryAfter: "3", body: "Rate limited" }));
        }
        return Promise.resolve(resp(200, { body: OAUTH1_BODY }));
      }
      if (url.includes("/oauth-service/oauth/exchange") && method === "POST") {
        return Promise.resolve(resp(200, { body: OAUTH2_JSON }));
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    });

    const promise = startGarminLogin("user@example.com", "pw");
    // Advancing by less than the 3s Retry-After should not trigger the retry yet.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(preauthAttempts).toBe(1);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.status).toBe("complete");
    expect(preauthAttempts).toBe(2);
  });
});
