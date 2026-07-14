import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only axios; oauth-1.0a and tough-cookie run for real so signing and the
// cookie jar are genuinely exercised.
const mocks = vi.hoisted(() => {
  const request = vi.fn();
  const get = vi.fn();
  return { request, get };
});

vi.mock("axios", () => ({
  default: {
    create: () => ({ request: mocks.request }),
    get: mocks.get,
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

// Route a mocked request by URL + method. `signinPost` decides step-2 outcome.
function router(signinPost: string) {
  return (config: { url: string; method: string; headers?: Record<string, string> }) => {
    const { url, method } = config;
    if (url.includes("/sso/embed") && method === "GET") {
      return Promise.resolve({
        status: 200,
        headers: { "set-cookie": ["GARMIN-SSO-GUID=g1; Path=/"] },
        data: "",
      });
    }
    if (url.includes("/sso/signin") && method === "GET") {
      return Promise.resolve({
        status: 200,
        headers: { "set-cookie": ["SESSIONID=s1; Path=/"] },
        data: SIGNIN_PAGE,
      });
    }
    if (url.includes("/sso/signin") && method === "POST") {
      return Promise.resolve({ status: 200, headers: {}, data: signinPost });
    }
    if (url.includes("/sso/verifyMFA") && method === "POST") {
      return Promise.resolve({ status: 200, headers: {}, data: TICKET_PAGE });
    }
    if (url.includes("/oauth-service/oauth/preauthorized") && method === "GET") {
      // Capture that this call was OAuth1-signed.
      expect(config.headers?.Authorization).toMatch(/^OAuth /);
      return Promise.resolve({ status: 200, headers: {}, data: OAUTH1_BODY });
    }
    if (url.includes("/oauth-service/oauth/exchange") && method === "POST") {
      return Promise.resolve({ status: 200, headers: {}, data: OAUTH2_JSON });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  };
}

beforeEach(() => {
  mocks.request.mockReset();
  mocks.get.mockReset();
  mocks.get.mockResolvedValue({ data: { consumer_key: "ck", consumer_secret: "cs" } });
});

describe("startGarminLogin", () => {
  it("completes without MFA and returns garmin-connect-shaped tokens", async () => {
    mocks.request.mockImplementation(router(TICKET_PAGE));

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
    mocks.request.mockImplementation(router(MFA_PAGE));

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
    mocks.request.mockImplementation((config: { url: string; method: string }) => {
      if (config.url.includes("/sso/signin") && config.method === "GET") {
        return Promise.resolve({ status: 200, headers: {}, data: "<html>no csrf here</html>" });
      }
      return Promise.resolve({ status: 200, headers: {}, data: "" });
    });

    await expect(startGarminLogin("u", "p")).rejects.toBeInstanceOf(GarminUnavailableError);
  });

  it("throws GarminAuthError on bad credentials (no ticket, no MFA)", async () => {
    mocks.request.mockImplementation(router("<html><body>Invalid</body></html>"));

    await expect(startGarminLogin("u", "p")).rejects.toBeInstanceOf(GarminAuthError);
  });
});

describe("resumeGarminLogin", () => {
  it("submits the code, exchanges the ticket, and returns tokens", async () => {
    mocks.request.mockImplementation(router(MFA_PAGE));
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
    mocks.request.mockImplementation((config: { url: string; method: string }) => {
      if (config.url.includes("/sso/verifyMFA")) {
        return Promise.resolve({ status: 200, headers: {}, data: "<html>wrong code</html>" });
      }
      throw new Error(`unexpected ${config.method} ${config.url}`);
    });

    await expect(resumeGarminLogin(pending, "000000")).rejects.toBeInstanceOf(GarminAuthError);
  });
});
