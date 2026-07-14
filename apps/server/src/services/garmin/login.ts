import { createHmac } from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import OAuth from "oauth-1.0a";
import { CookieJar, type SerializedCookieJar } from "tough-cookie";
import { GarminAuthError, GarminUnavailableError, type StoredTokens } from "./types.js";

// Self-contained Garmin SSO login that CAN answer a two-step-verification (MFA)
// challenge — the bundled `garmin-connect` library cannot (its `handleMFA` is an
// empty stub). We reproduce Garmin's documented SSO handshake (the same one garth
// / python-garminconnect use) and hand the resulting OAuth token pair to
// `GarminConnect.loadToken`, so the entire data layer in client.ts is untouched.
//
// Flow: fetch OAuth consumer → GET signin (scrape _csrf, collect cookies) → POST
// username/password. If 2FA is on, that POST returns an MFA page instead of a
// service ticket; the caller stores `PendingLogin` and later calls
// `resumeGarminLogin` with the code. Otherwise login completes immediately.

const OAUTH_CONSUMER_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";
const GARMIN_SSO_ORIGIN = "https://sso.garmin.com";
const GARMIN_SSO = `${GARMIN_SSO_ORIGIN}/sso`;
const GARMIN_SSO_EMBED = `${GARMIN_SSO}/embed`;
const SIGNIN_URL = `${GARMIN_SSO}/signin`;
const VERIFY_MFA_URL = `${GARMIN_SSO}/verifyMFA/loginEnterMfaCode`;
const GC_MODERN = "https://connect.garmin.com/modern";
const OAUTH_URL = "https://connectapi.garmin.com/oauth-service/oauth";

const USER_AGENT_CONNECTMOBILE = "com.garmin.android.apps.connectmobile";
const USER_AGENT_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

const CSRF_RE = /name="_csrf"\s+value="(.+?)"/;
const TICKET_RE = /ticket=([^"]+)"/;
const ACCOUNT_LOCKED_RE = /var\s+status\s*=\s*"([^"]*locked[^"]*)"/i;
const PAGE_TITLE_RE = /<title>([^<]*)<\/title>/;
// The MFA form posts to verifyMFA and exposes an `mfa-code` field — either signal
// means Garmin wants the second factor rather than a failed password.
const MFA_RE = /verifyMFA|mfa-code|setupEnterMfaCode/i;

type Consumer = { key: string; secret: string };

// Serializable state carried between the password step and the MFA-code step.
// Holds the SSO session cookies + the MFA form's CSRF token — never the password.
export interface PendingLogin {
  cookies: SerializedCookieJar;
  mfaCsrf: string;
  signinParams: Record<string, string>;
  consumer: Consumer;
}

export type StartResult =
  | { status: "complete"; tokens: StoredTokens }
  | { status: "mfa_required"; pending: PendingLogin };

// The query params Garmin expects on the signin GET/POST and the MFA POST.
function signinParams(): Record<string, string> {
  return {
    id: "gauth-widget",
    embedWidget: "true",
    clientId: "GarminConnect",
    locale: "en",
    gauthHost: GARMIN_SSO_EMBED,
    service: GARMIN_SSO_EMBED,
    source: GARMIN_SSO_EMBED,
    redirectAfterAccountLoginUrl: GARMIN_SSO_EMBED,
    redirectAfterAccountCreationUrl: GARMIN_SSO_EMBED,
  };
}

function newClient(): AxiosInstance {
  // Text by default: the SSO endpoints return HTML and the OAuth1 endpoint returns
  // a form-encoded body; we parse each explicitly.
  return axios.create({ responseType: "text", transformResponse: [(d) => d] });
}

/**
 * GET/POST with an explicit cookie jar, following redirects manually so that
 * Set-Cookie headers on every hop land in the jar (axios drops intermediate ones).
 */
async function jarRequest(
  client: AxiosInstance,
  jar: CookieJar,
  method: "GET" | "POST",
  url: string,
  opts: { data?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: string }> {
  let currentUrl = url;
  let currentMethod = method;
  let data = opts.data;
  const headers = { ...opts.headers };

  for (let hop = 0; hop < 6; hop++) {
    const cookie = jar.getCookieStringSync(currentUrl);
    const res = await client.request({
      url: currentUrl,
      method: currentMethod,
      data,
      headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
      maxRedirects: 0,
      validateStatus: () => true,
    });

    const setCookies = res.headers["set-cookie"];
    if (Array.isArray(setCookies)) {
      for (const raw of setCookies) {
        try {
          jar.setCookieSync(raw, currentUrl);
        } catch {
          // Ignore cookies tough-cookie rejects (e.g. malformed domains).
        }
      }
    }

    const location = res.headers["location"] as string | undefined;
    if (res.status >= 300 && res.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      currentMethod = "GET";
      data = undefined;
      delete headers["Content-Type"];
      continue;
    }
    return { status: res.status, body: typeof res.data === "string" ? res.data : String(res.data) };
  }
  throw new GarminUnavailableError("Too many redirects during Garmin sign-in");
}

async function fetchConsumer(): Promise<Consumer> {
  try {
    const { data } = await axios.get<{ consumer_key: string; consumer_secret: string }>(
      OAUTH_CONSUMER_URL,
    );
    return { key: data.consumer_key, secret: data.consumer_secret };
  } catch (err) {
    throw new GarminUnavailableError(
      `Could not fetch Garmin OAuth consumer: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Turn a failed-looking signin/MFA response into the clearest possible error.
function assertNotBlocked(body: string): void {
  if (ACCOUNT_LOCKED_RE.test(body)) {
    throw new GarminAuthError(
      "Garmin account is locked — sign in on the Garmin website to unlock it, then try again",
    );
  }
  const title = PAGE_TITLE_RE.exec(body)?.[1] ?? "";
  if (/update phone number/i.test(title)) {
    throw new GarminAuthError("Garmin requires a phone-number update — resolve it on garmin.com first");
  }
}

/**
 * Step 1: fetch consumer, load the signin page (scrape CSRF, collect cookies),
 * then POST the credentials. Returns either finished tokens or an MFA challenge.
 */
export async function startGarminLogin(username: string, password: string): Promise<StartResult> {
  const consumer = await fetchConsumer();
  const client = newClient();
  const jar = new CookieJar();

  // Prime session cookies via the embed endpoint.
  await jarRequest(client, jar, "GET", `${GARMIN_SSO_EMBED}?${new URLSearchParams({
    clientId: "GarminConnect",
    locale: "en",
    service: GC_MODERN,
  })}`);

  const params = signinParams();
  const signinGetUrl = `${SIGNIN_URL}?${new URLSearchParams(params)}`;
  const signinPage = await jarRequest(client, jar, "GET", signinGetUrl);
  const csrf = CSRF_RE.exec(signinPage.body)?.[1];
  if (!csrf) {
    throw new GarminUnavailableError(
      "Garmin sign-in page did not contain a CSRF token (the login page may have changed or been blocked)",
    );
  }

  const form = new URLSearchParams({ username, password, embed: "true", _csrf: csrf }).toString();
  const result = await jarRequest(client, jar, "POST", signinGetUrl, {
    data: form,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: GARMIN_SSO_ORIGIN,
      Referer: signinGetUrl,
      "User-Agent": USER_AGENT_BROWSER,
    },
  });

  const ticket = TICKET_RE.exec(result.body)?.[1];
  if (ticket) {
    const tokens = await ticketToTokens(client, jar, ticket, consumer);
    return { status: "complete", tokens };
  }

  assertNotBlocked(result.body);

  if (MFA_RE.test(result.body)) {
    const mfaCsrf = CSRF_RE.exec(result.body)?.[1];
    if (!mfaCsrf) {
      throw new GarminUnavailableError("Garmin asked for a verification code but no MFA form was found");
    }
    return {
      status: "mfa_required",
      pending: { cookies: jar.serializeSync()!, mfaCsrf, signinParams: params, consumer },
    };
  }

  throw new GarminAuthError(
    "Garmin sign-in failed — double-check your email and password",
  );
}

/**
 * Step 2: submit the MFA code against the pending SSO session and finish login.
 */
export async function resumeGarminLogin(
  pending: PendingLogin,
  mfaCode: string,
): Promise<{ tokens: StoredTokens }> {
  const client = newClient();
  const jar = CookieJar.deserializeSync(pending.cookies);
  const verifyUrl = `${VERIFY_MFA_URL}?${new URLSearchParams(pending.signinParams)}`;
  const signinGetUrl = `${SIGNIN_URL}?${new URLSearchParams(pending.signinParams)}`;

  const form = new URLSearchParams({
    "mfa-code": mfaCode,
    embed: "true",
    _csrf: pending.mfaCsrf,
    fromPage: "setupEnterMfaCode",
  }).toString();

  const result = await jarRequest(client, jar, "POST", verifyUrl, {
    data: form,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: GARMIN_SSO_ORIGIN,
      Referer: signinGetUrl,
      "User-Agent": USER_AGENT_BROWSER,
    },
  });

  const ticket = TICKET_RE.exec(result.body)?.[1];
  if (!ticket) {
    assertNotBlocked(result.body);
    throw new GarminAuthError(
      "That verification code didn't work — it may be expired or mistyped. Request a new code and try again.",
    );
  }

  const tokens = await ticketToTokens(client, jar, ticket, pending.consumer);
  return { tokens };
}

function oauthClient(consumer: Consumer): OAuth {
  return new OAuth({
    consumer,
    signature_method: "HMAC-SHA1",
    hash_function: (base, key) => createHmac("sha1", key).update(base).digest("base64"),
  });
}

/**
 * Exchange an SSO service ticket for the OAuth1 token, then OAuth2 tokens — the
 * shape `GarminConnect.loadToken` expects. Mirrors garmin-connect's own steps 4/5.
 */
async function ticketToTokens(
  client: AxiosInstance,
  jar: CookieJar,
  ticket: string,
  consumer: Consumer,
): Promise<StoredTokens> {
  const oauth = oauthClient(consumer);

  // Step 4 — OAuth1 token (Authorization header carries the HMAC-SHA1 signature).
  const preauthUrl = `${OAUTH_URL}/preauthorized?${new URLSearchParams({
    ticket,
    "login-url": GARMIN_SSO_EMBED,
    "accepts-mfa-tokens": "true",
  })}`;
  const preauthHeaders = oauth.toHeader(oauth.authorize({ url: preauthUrl, method: "GET" }));
  const oauth1Res = await jarRequest(client, jar, "GET", preauthUrl, {
    headers: { ...preauthHeaders, "User-Agent": USER_AGENT_CONNECTMOBILE },
  });
  const oauth1Parsed = new URLSearchParams(oauth1Res.body);
  const oauth_token = oauth1Parsed.get("oauth_token");
  const oauth_token_secret = oauth1Parsed.get("oauth_token_secret");
  if (!oauth_token || !oauth_token_secret) {
    throw new GarminUnavailableError("Garmin did not return an OAuth1 token after sign-in");
  }
  const oauth1 = { oauth_token, oauth_token_secret };

  // Step 5 — exchange OAuth1 for OAuth2 (signed params go in the query string).
  const exchangeBase = `${OAUTH_URL}/exchange/user/2.0`;
  const authData = oauth.authorize(
    { url: exchangeBase, method: "POST", data: null as unknown as undefined },
    { key: oauth_token, secret: oauth_token_secret },
  );
  const exchangeUrl = `${exchangeBase}?${new URLSearchParams(
    authData as unknown as Record<string, string>,
  )}`;
  const exchangeRes = await jarRequest(client, jar, "POST", exchangeUrl, {
    headers: {
      "User-Agent": USER_AGENT_CONNECTMOBILE,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(exchangeRes.body) as Record<string, unknown>;
  } catch {
    throw new GarminUnavailableError("Garmin returned an unreadable OAuth2 token response");
  }

  const oauth2 = withExpiry(raw);
  return { oauth1, oauth2 } as StoredTokens;
}

// Add the derived expiry fields garmin-connect stamps on the OAuth2 token so its
// built-in refresh logic works when we later loadToken(). Mirrors setOauth2TokenExpiresAt.
function withExpiry(token: Record<string, unknown>): StoredTokens["oauth2"] {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = Number(token.expires_in ?? 0);
  const refreshExpiresIn = Number(token.refresh_token_expires_in ?? 0);
  return {
    ...token,
    last_update_date: new Date().toISOString(),
    expires_date: new Date((nowSec + expiresIn) * 1000).toISOString(),
    expires_at: nowSec + expiresIn,
    refresh_token_expires_at: nowSec + refreshExpiresIn,
  } as StoredTokens["oauth2"];
}
