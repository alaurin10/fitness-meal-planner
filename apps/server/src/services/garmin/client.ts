// garmin-connect is CommonJS and its dist/index.js defines the `GarminConnect`
// export via Object.defineProperty(exports, "GarminConnect", { get: ... })
// rather than a plain assignment. Node's native ESM loader statically analyzes
// CJS exports (cjs-module-lexer) to support `import { X } from "cjsPkg"`, and
// it doesn't recognize getter-defined exports — so that form throws "Named
// export 'GarminConnect' not found" at runtime under plain `node dist/index.js`
// (tsx's looser dev-time transform doesn't hit this). The default import is
// always safe: it resolves to the whole CJS exports object at runtime. The
// package's .d.ts correctly describes that object's shape (just not in a way
// the runtime export detector recognizes), so we use a type-only import for
// typing and bridge it to the live value with one cast at the boundary.
import garminConnectPkgRaw from "garmin-connect";
import type { GarminConnect } from "garmin-connect";
const garminConnectPkg = garminConnectPkgRaw as unknown as { GarminConnect: typeof GarminConnect };
import { prisma } from "@platform/db";
import { encryptJson, decryptJson } from "./crypto.js";
import { buildWorkoutServicePayload } from "./workoutPush.js";
import { startGarminLogin, resumeGarminLogin, withExpiry } from "./login.js";
import { putPending, takePending } from "./pendingLogins.js";
import {
  GarminAuthError,
  GarminUnavailableError,
  type GarminActivitySummary,
  type GarminApi,
  type GarminDailySummary,
  type GarminExerciseSet,
  type GarminWeighIn,
  type GarminWorkoutPayload,
  type StoredTokens,
} from "./types.js";

// The ONLY file that talks to the unofficial garmin-connect library / Garmin
// HTTP endpoints. Everything else consumes the GarminApi interface, so an
// upstream API change is contained here. Credential sign-in (incl. MFA) lives in
// login.ts, which produces the same token shape this file stores and loads.

const GC_API = "https://connectapi.garmin.com";

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

interface RawWeightMetric {
  samplePk?: number;
  weight?: number;
  calendarDate?: string;
}

/**
 * Smart scales often send a preliminary reading followed a few seconds later by
 * the final, settled one (once the body-composition impedance measurement
 * completes) — both land in the same day's metrics. `samplePk` is a millisecond
 * epoch timestamp, so keep only the latest sample per calendar day; Garmin's own
 * "current weight" (surfaced via previousDateWeight/nextDateWeight on this same
 * endpoint) tracks the latest sample too, confirming it's the authoritative one.
 */
export function pickLatestWeighInPerDay(metrics: RawWeightMetric[]): GarminWeighIn[] {
  const latestByDay = new Map<string, { samplePk: number; weight: number }>();
  for (const m of metrics) {
    const weight = asNumber(m.weight);
    if (m.samplePk == null || weight == null || !m.calendarDate) continue;
    const existing = latestByDay.get(m.calendarDate);
    if (!existing || m.samplePk > existing.samplePk) {
      latestByDay.set(m.calendarDate, { samplePk: m.samplePk, weight });
    }
  }
  return Array.from(latestByDay.entries()).map(([dayKey, { samplePk, weight }]) => ({
    samplePk,
    dayKey,
    weightGrams: weight,
  }));
}

interface RawExerciseSet {
  exercises?: { category?: string | null; name?: string | null; probability?: number }[];
  setType?: string;
  repetitionCount?: number;
  weight?: number;
  duration?: number;
  startTime?: string;
  wkStepIndex?: number;
}

/**
 * Normalize one raw exerciseSets entry. Garmin attaches a list of candidate
 * exercise identifications with probabilities; keep the most probable one.
 * Every field is optional in the wild, so absent values become null.
 */
export function normalizeExerciseSet(raw: RawExerciseSet): GarminExerciseSet {
  let best: { category?: string | null; name?: string | null; probability?: number } | null = null;
  for (const candidate of raw.exercises ?? []) {
    if (!best || (candidate.probability ?? 0) > (best.probability ?? 0)) best = candidate;
  }
  return {
    setType: raw.setType ?? "ACTIVE",
    category: best?.category ?? null,
    name: best?.name ?? null,
    reps: asNumber(raw.repetitionCount),
    weightGrams: asNumber(raw.weight),
    durationSeconds: asNumber(raw.duration),
    startTimeGMT: typeof raw.startTime === "string" ? raw.startTime : null,
    wkStepIndex: asNumber(raw.wkStepIndex),
  };
}

/**
 * The library's constructor throws unless `credentials` is truthy (it also
 * accepts a `garmin.config.json` file via app-root-path, which we don't use) —
 * but `loadToken()` never reads `this.credentials`, only `.login()` does, and we
 * never call `.login()` on a token-based session. So a placeholder satisfies the
 * check without any real credentials on hand.
 */
function tokenClient(tokens: StoredTokens): GarminConnect {
  const gc = new garminConnectPkg.GarminConnect({ username: "", password: "" });
  gc.loadToken(tokens.oauth1, tokens.oauth2);
  return gc;
}

/** Best-effort Garmin displayName (used in API paths); null is fine, resolved lazily on sync. */
async function resolveDisplayName(tokens: StoredTokens): Promise<string | null> {
  try {
    const gc = tokenClient(tokens);
    const profile = await gc.getUserProfile();
    return profile.displayName ?? null;
  } catch {
    return null;
  }
}

/** Persist ONLY the OAuth tokens (encrypted) and the linked identity — never the password. */
async function persistLinkedTokens(
  userId: string,
  tokens: StoredTokens,
  garminUserId: string | null,
): Promise<void> {
  const encryptedTokens = encryptJson(tokens satisfies StoredTokens);
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  await prisma.garminConnection.upsert({
    where: { userId },
    update: { encryptedTokens, garminUserId, lastSyncStatus: "never", lastSyncError: null },
    create: { userId, encryptedTokens, garminUserId },
  });
}

/**
 * Step 1 of linking: sign in with credentials. If the account requires two-step
 * verification, stash the pending SSO session and report `mfaRequired: true` —
 * the caller then collects a code and calls `completeLinkWithMfa`. Otherwise the
 * account is linked immediately.
 */
export async function startLink(
  userId: string,
  username: string,
  password: string,
): Promise<{ mfaRequired: boolean; garminUserId?: string | null }> {
  const result = await startGarminLogin(username, password);
  if (result.status === "mfa_required") {
    putPending(userId, result.pending);
    return { mfaRequired: true };
  }
  const garminUserId = await resolveDisplayName(result.tokens);
  await persistLinkedTokens(userId, result.tokens, garminUserId);
  return { mfaRequired: false, garminUserId };
}

/**
 * Step 2 of linking: finish a pending MFA login with the user's code.
 * Throws GarminAuthError if there is no pending attempt (expired/never started).
 */
export async function completeLinkWithMfa(
  userId: string,
  code: string,
): Promise<{ garminUserId: string | null }> {
  const pending = takePending(userId);
  if (!pending) {
    throw new GarminAuthError(
      "Your sign-in session expired — start connecting your Garmin account again",
    );
  }
  const { tokens } = await resumeGarminLogin(pending, code);
  const garminUserId = await resolveDisplayName(tokens);
  await persistLinkedTokens(userId, tokens, garminUserId);
  return { garminUserId };
}

/**
 * Alternate link path for when Garmin's SSO rate-limits this server's shared
 * datacenter IP (waiting doesn't help — the limit is on the IP's reputation,
 * not the account): the user runs `pnpm --filter @app/server garmin:export-tokens`
 * on their own machine, where Garmin accepts the sign-in, and pastes the JSON it
 * prints. Tokens are verified against Garmin before being stored, so a bad paste
 * can never clobber a working connection with dead tokens.
 */
export async function linkWithImportedTokens(
  userId: string,
  raw: unknown,
): Promise<{ garminUserId: string | null }> {
  const tokens = parseImportedTokens(raw);

  let garminUserId: string | null;
  try {
    const gc = tokenClient(tokens);
    const profile = await gc.getUserProfile();
    garminUserId = profile.displayName ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GarminAuthError(
      `Garmin rejected those tokens — run the export script again for a fresh set (${msg})`,
    );
  }

  await persistLinkedTokens(userId, tokens, garminUserId);
  return { garminUserId };
}

function parseImportedTokens(raw: unknown): StoredTokens {
  const obj = raw as
    | { oauth1?: Record<string, unknown>; oauth2?: Record<string, unknown> }
    | null
    | undefined;
  const oauth1 = obj?.oauth1;
  const oauth2 = obj?.oauth2;
  const nonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  if (
    !nonEmptyString(oauth1?.oauth_token) ||
    !nonEmptyString(oauth1?.oauth_token_secret) ||
    !nonEmptyString(oauth2?.access_token) ||
    !nonEmptyString(oauth2?.refresh_token)
  ) {
    throw new GarminAuthError(
      "That isn't a Garmin token export — paste the exact JSON line printed by the export script",
    );
  }
  // Exports from other tools (e.g. garth) may lack the derived expiry fields
  // garmin-connect's refresh logic reads; stamp them the same way login does.
  const oauth2Full =
    typeof oauth2.expires_at === "number"
      ? (oauth2 as unknown as StoredTokens["oauth2"])
      : withExpiry(oauth2);
  return { oauth1, oauth2: oauth2Full } as unknown as StoredTokens;
}

export interface GarminSession {
  api: GarminApi;
  /** Re-encrypt and persist the (possibly refreshed) tokens. Call after use. */
  persistTokens: () => Promise<void>;
}

/** Returns null when the user has no Garmin connection. */
export async function getGarminSession(userId: string): Promise<GarminSession | null> {
  const connection = await prisma.garminConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  const tokens = decryptJson<StoredTokens>(connection.encryptedTokens);
  const gc = tokenClient(tokens);

  let displayName = connection.garminUserId;

  const api: GarminApi = {
    async getDisplayName() {
      if (displayName) return displayName;
      const profile = await call(() => gc.getUserProfile());
      displayName = profile.displayName;
      await prisma.garminConnection.update({
        where: { userId },
        data: { garminUserId: displayName },
      });
      return displayName;
    },

    async getDailySummary(dayKey: string): Promise<GarminDailySummary> {
      const dn = await this.getDisplayName();
      const raw = await call(() =>
        gc.get<Record<string, unknown>>(
          `${GC_API}/usersummary-service/usersummary/daily/${dn}`,
          { params: { calendarDate: dayKey } },
        ),
      );
      return {
        steps: asNumber(raw?.totalSteps),
        totalKilocalories: asNumber(raw?.totalKilocalories),
        activeKilocalories: asNumber(raw?.activeKilocalories),
        restingHeartRate: asNumber(raw?.restingHeartRate),
      };
    },

    async getSleepSeconds(dayKey: string): Promise<number | null> {
      const dn = await this.getDisplayName();
      const raw = await call(() =>
        gc.get<{ dailySleepDTO?: { sleepTimeSeconds?: number } }>(
          `${GC_API}/wellness-service/wellness/dailySleepData/${dn}`,
          { params: { date: dayKey } },
        ),
      );
      return asNumber(raw?.dailySleepDTO?.sleepTimeSeconds);
    },

    async getActivities(start: number, limit: number): Promise<GarminActivitySummary[]> {
      const raw = await call(() => gc.getActivities(start, limit));
      return (raw ?? []).map((a) => ({
        activityId: a.activityId,
        activityName: a.activityName,
        typeKey: a.activityType?.typeKey ?? "other",
        startTimeLocal: a.startTimeLocal,
        startTimeGMT: a.startTimeGMT,
        durationSeconds: asNumber(a.duration),
        distanceMeters: asNumber(a.distance),
        calories: asNumber(a.calories),
      }));
    },

    async getActivityExerciseSets(activityId: string): Promise<GarminExerciseSet[]> {
      const raw = await call(() =>
        gc.get<{ exerciseSets?: RawExerciseSet[] }>(
          `${GC_API}/activity-service/activity/${activityId}/exerciseSets`,
        ),
      );
      if (process.env.GARMIN_DEBUG === "1") {
        console.warn("[garmin] exerciseSets raw payload:", JSON.stringify(raw));
      }
      return (raw?.exerciseSets ?? []).map(normalizeExerciseSet);
    },

    async getWeighIns(fromDayKey: string, toDayKey: string): Promise<GarminWeighIn[]> {
      // Range endpoint used by the Garmin web app; one call covers the window.
      const raw = await call(() =>
        gc.get<{
          dailyWeightSummaries?: {
            summaryDate?: string;
            allWeightMetrics?: { samplePk?: number; weight?: number; calendarDate?: string }[];
          }[];
          dateWeightList?: { samplePk?: number; weight?: number; calendarDate?: string }[];
        }>(`${GC_API}/weight-service/weight/range/${fromDayKey}/${toDayKey}`, {
          params: { includeAll: true },
        }),
      );
      const metrics =
        raw?.dailyWeightSummaries?.flatMap((d) =>
          (d.allWeightMetrics ?? []).map((m) => ({ ...m, calendarDate: m.calendarDate ?? d.summaryDate })),
        ) ??
        raw?.dateWeightList ??
        [];
      return pickLatestWeighInPerDay(metrics);
    },

    async pushWeight(lbs: number): Promise<void> {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await call(() => gc.updateWeight(undefined, lbs, timezone));
    },

    async createStrengthWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }> {
      const body = buildWorkoutServicePayload(payload);
      const created = await call(() =>
        gc.post<{ workoutId?: number | string }>(`${GC_API}/workout-service/workout`, body),
      );
      if (created?.workoutId == null) {
        throw new GarminUnavailableError("Garmin did not return a workoutId for the created workout");
      }
      return { workoutId: String(created.workoutId) };
    },

    async scheduleWorkout(workoutId: string, dayKey: string): Promise<void> {
      await call(() =>
        gc.post(`${GC_API}/workout-service/schedule/${workoutId}`, { date: dayKey }),
      );
    },

    async deleteWorkout(workoutId: string): Promise<void> {
      await call(() => gc.deleteWorkout({ workoutId }));
    },
  };

  return {
    api,
    persistTokens: async () => {
      // OAuth2 access tokens auto-refresh inside the client; re-persist so the
      // stored blob keeps working across the 3-month refresh horizon.
      const latest = gc.exportToken();
      await prisma.garminConnection.update({
        where: { userId },
        data: { encryptedTokens: encryptJson(latest satisfies StoredTokens) },
      });
    },
  };
}

/** Normalize unofficial-API failures into typed errors. Exported for tests. */
export function classifyGarminCallError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  // Rate limiting is transient — never tell the user to reconnect over it. A 429
  // during the client's internal token refresh used to fall through to the auth
  // regex below (via "refresh") and demand a needless re-link, pushing the user
  // back into the SSO sign-in that Garmin was rate-limiting in the first place.
  if (/429|too many requests/i.test(msg)) {
    return new GarminUnavailableError(
      "Garmin is rate-limiting requests right now — try again in a few minutes",
    );
  }
  if (/401|403|unauthorized|forbidden|refresh/i.test(msg)) {
    return new GarminAuthError(`Garmin session expired — reconnect your account (${msg})`);
  }
  return new GarminUnavailableError(`Garmin request failed: ${msg}`);
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw classifyGarminCallError(err);
  }
}
