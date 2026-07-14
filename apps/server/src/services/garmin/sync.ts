import { prisma } from "@platform/db";
import { applyWeightToProfile } from "../weightSync.js";
import type { GarminActivitySummary, GarminApi } from "./types.js";

// Pull-based sync: wellness (steps/calories/HR/sleep), activities, weigh-ins.
// Requests run sequentially and the backfill window is capped so a sync never
// hammers Garmin. Everything upserts, so re-syncing is idempotent.

export const SYNC_COOLDOWN_MINUTES = 15;
export const DEFAULT_BACKFILL_DAYS = 30;
const ACTIVITY_PAGE_SIZE = 50;
const GRAMS_PER_POUND = 453.59237;
const METERS_PER_MILE = 1609.344;

export interface SyncResult {
  skipped?: "cooldown" | "already_syncing";
  wellnessDays: number;
  activitiesImported: number;
  weightsImported: number;
  errors: string[];
}

export function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD keys from `from` to `to`. */
export function dayKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cursor <= end) {
    keys.push(dayKeyOf(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/** Map a Garmin activity summary onto ActivityLog columns. Exported for tests. */
export function mapGarminActivity(a: GarminActivitySummary): {
  activityName: string;
  performedAt: Date;
  durationMinutes: number | null;
  activeCalories: number | null;
  distanceMiles: number | null;
  externalId: string;
} {
  // startTimeGMT is "YYYY-MM-DD HH:mm:ss" — an unambiguous UTC instant.
  const performedAt = new Date(a.startTimeGMT.replace(" ", "T") + "Z");
  const fallbackName = a.typeKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return {
    activityName: (a.activityName || fallbackName).slice(0, 100),
    performedAt,
    durationMinutes:
      a.durationSeconds != null && a.durationSeconds > 0
        ? Math.max(1, Math.round(a.durationSeconds / 60))
        : null,
    activeCalories: a.calories != null && a.calories > 0 ? Math.round(a.calories) : null,
    distanceMiles:
      a.distanceMeters != null && a.distanceMeters > 0
        ? Math.round((a.distanceMeters / METERS_PER_MILE) * 100) / 100
        : null,
    externalId: String(a.activityId),
  };
}

export function gramsToPounds(grams: number): number {
  return Math.round((grams / GRAMS_PER_POUND) * 10) / 10;
}

interface SyncOptions {
  force?: boolean;
  backfillDays?: number;
  now?: Date;
}

/**
 * Run a full sync for a connected user. The caller provides the GarminApi so
 * tests can substitute a mock. Sections fail independently: a Garmin hiccup in
 * one leaves the others' data in place and is reported in `errors`.
 */
export async function syncUser(
  userId: string,
  api: GarminApi,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const backfillDays = Math.min(opts.backfillDays ?? DEFAULT_BACKFILL_DAYS, 90);

  const connection = await prisma.garminConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("Garmin is not connected");

  const result: SyncResult = {
    wellnessDays: 0,
    activitiesImported: 0,
    weightsImported: 0,
    errors: [],
  };

  if (connection.lastSyncStatus === "syncing") {
    // Tolerate a crashed sync: treat a stale "syncing" marker as abandoned.
    const staleMs = now.getTime() - connection.updatedAt.getTime();
    if (staleMs < 10 * 60 * 1000) {
      result.skipped = "already_syncing";
      return result;
    }
  } else if (
    !opts.force &&
    connection.lastSyncAt != null &&
    now.getTime() - connection.lastSyncAt.getTime() < SYNC_COOLDOWN_MINUTES * 60 * 1000
  ) {
    result.skipped = "cooldown";
    return result;
  }

  await prisma.garminConnection.update({
    where: { userId },
    data: { lastSyncStatus: "syncing" },
  });

  // Window: resume a day before the last sync (to catch late device uploads),
  // never further back than the backfill cap.
  const capStart = new Date(now.getTime() - backfillDays * 24 * 60 * 60 * 1000);
  const resumeStart = connection.lastSyncAt
    ? new Date(connection.lastSyncAt.getTime() - 24 * 60 * 60 * 1000)
    : capStart;
  const windowStart = resumeStart > capStart ? resumeStart : capStart;
  const fromDayKey = dayKeyOf(windowStart);
  const toDayKey = dayKeyOf(now);

  // ── Wellness ──
  try {
    for (const dayKey of dayKeysBetween(fromDayKey, toDayKey)) {
      const [summary, sleepSeconds] = [
        await api.getDailySummary(dayKey),
        await api.getSleepSeconds(dayKey).catch(() => null),
      ];
      const hasData =
        summary.steps != null ||
        summary.totalKilocalories != null ||
        summary.activeKilocalories != null ||
        summary.restingHeartRate != null ||
        sleepSeconds != null;
      if (!hasData) continue;
      const data = {
        steps: summary.steps,
        totalKilocalories: summary.totalKilocalories,
        activeKilocalories: summary.activeKilocalories,
        restingHeartRate: summary.restingHeartRate,
        sleepSeconds,
      };
      await prisma.dailyWellness.upsert({
        where: { userId_dayKey: { userId, dayKey } },
        update: data,
        create: { userId, dayKey, ...data },
      });
      result.wellnessDays += 1;
    }
  } catch (err) {
    result.errors.push(`wellness: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Activities ──
  try {
    let start = 0;
    pages: while (true) {
      const page = await api.getActivities(start, ACTIVITY_PAGE_SIZE);
      if (page.length === 0) break;
      for (const activity of page) {
        const mapped = mapGarminActivity(activity);
        if (mapped.performedAt < windowStart) break pages; // most-recent-first
        await prisma.activityLog.upsert({
          where: {
            userId_source_externalId: {
              userId,
              source: "garmin",
              externalId: mapped.externalId,
            },
          },
          update: {
            activityName: mapped.activityName,
            performedAt: mapped.performedAt,
            durationMinutes: mapped.durationMinutes,
            activeCalories: mapped.activeCalories,
            distanceMiles: mapped.distanceMiles,
          },
          create: { userId, source: "garmin", ...mapped },
        });
        result.activitiesImported += 1;
      }
      if (page.length < ACTIVITY_PAGE_SIZE) break;
      start += ACTIVITY_PAGE_SIZE;
    }
  } catch (err) {
    result.errors.push(`activities: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Weigh-ins ──
  try {
    const weighIns = await api.getWeighIns(fromDayKey, toDayKey);
    // Manual logs in the window: a weigh-in we pushed TO Garmin comes back on
    // the next sync, so skip Garmin samples that echo a manual log (same day,
    // same weight) instead of duplicating them.
    const manualLogs = await prisma.progressLog.findMany({
      where: {
        userId,
        source: "manual",
        weightLbs: { not: null },
        loggedAt: { gte: new Date(fromDayKey + "T00:00:00Z") },
      },
      select: { loggedAt: true, weightLbs: true },
    });
    let newest: { dayKey: string; lbs: number } | null = null;
    for (const w of weighIns) {
      const lbs = gramsToPounds(w.weightGrams);
      const isEcho = manualLogs.some(
        (m) =>
          m.weightLbs != null &&
          Math.abs(m.weightLbs - lbs) < 0.2 &&
          m.loggedAt.toISOString().slice(0, 10) === w.dayKey,
      );
      if (isEcho) {
        if (!newest || w.dayKey > newest.dayKey) newest = { dayKey: w.dayKey, lbs };
        continue;
      }
      await prisma.progressLog.upsert({
        where: {
          userId_source_externalId: {
            userId,
            source: "garmin",
            externalId: String(w.samplePk),
          },
        },
        update: { weightLbs: lbs },
        create: {
          userId,
          source: "garmin",
          externalId: String(w.samplePk),
          loggedAt: new Date(w.dayKey + "T12:00:00Z"),
          weightLbs: lbs,
          note: "Synced from Garmin",
        },
      });
      result.weightsImported += 1;
      if (!newest || w.dayKey > newest.dayKey) newest = { dayKey: w.dayKey, lbs };
    }
    if (newest) await applyWeightToProfile(userId, newest.lbs);
  } catch (err) {
    result.errors.push(`weight: ${err instanceof Error ? err.message : String(err)}`);
  }

  await prisma.garminConnection.update({
    where: { userId },
    data: {
      lastSyncAt: now,
      lastSyncStatus: result.errors.length > 0 ? "error" : "ok",
      lastSyncError: result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null,
    },
  });

  return result;
}
