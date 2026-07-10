import { GarminConnect } from "garmin-connect";
import { prisma } from "@platform/db";
import { encryptJson, decryptJson } from "./crypto.js";
import { buildWorkoutServicePayload } from "./workoutPush.js";
import {
  GarminAuthError,
  GarminUnavailableError,
  type GarminActivitySummary,
  type GarminApi,
  type GarminDailySummary,
  type GarminWeighIn,
  type GarminWorkoutPayload,
} from "./types.js";

// The ONLY file that talks to the unofficial garmin-connect library / Garmin
// HTTP endpoints. Everything else consumes the GarminApi interface, so an
// upstream API change is contained here.

const GC_API = "https://connectapi.garmin.com";

type StoredTokens = {
  oauth1: Parameters<GarminConnect["loadToken"]>[0];
  oauth2: Parameters<GarminConnect["loadToken"]>[1];
};

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Log in with raw credentials, persist ONLY the exported OAuth tokens
 * (encrypted) and never the password, and return the linked identity.
 */
export async function linkGarminAccount(
  userId: string,
  username: string,
  password: string,
): Promise<{ garminUserId: string | null }> {
  const gc = new GarminConnect({ username, password });
  try {
    await gc.login();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The library throws generic errors; a failed SSO handshake here is almost
    // always bad credentials or an MFA challenge we can't answer.
    throw new GarminAuthError(
      `Garmin sign-in failed (check credentials; MFA-enabled accounts are not supported): ${msg}`,
    );
  }

  const tokens = gc.exportToken();
  let garminUserId: string | null = null;
  try {
    const profile = await gc.getUserProfile();
    garminUserId = profile.displayName ?? null;
  } catch {
    // Non-fatal: displayName can be fetched lazily on first sync.
  }

  const encryptedTokens = encryptJson(tokens satisfies StoredTokens);
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  await prisma.garminConnection.upsert({
    where: { userId },
    update: { encryptedTokens, garminUserId, lastSyncStatus: "never", lastSyncError: null },
    create: { userId, encryptedTokens, garminUserId },
  });
  return { garminUserId };
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
  const gc = new GarminConnect();
  gc.loadToken(tokens.oauth1, tokens.oauth2);

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
      const out: GarminWeighIn[] = [];
      for (const m of metrics) {
        const weight = asNumber(m.weight);
        if (m.samplePk == null || weight == null || !m.calendarDate) continue;
        out.push({ samplePk: m.samplePk, dayKey: m.calendarDate, weightGrams: weight });
      }
      return out;
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

/** Normalize unofficial-API failures into typed errors. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/401|403|unauthorized|forbidden|refresh/i.test(msg)) {
      throw new GarminAuthError(`Garmin session expired — reconnect your account (${msg})`);
    }
    throw new GarminUnavailableError(`Garmin request failed: ${msg}`);
  }
}
