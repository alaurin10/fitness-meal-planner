import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GarminApi } from "./types.js";

const prismaMock = vi.hoisted(() => ({
  garminConnection: { findUnique: vi.fn(), update: vi.fn() },
  dailyWellness: { upsert: vi.fn() },
  activityLog: { upsert: vi.fn(), findUnique: vi.fn() },
  progressLog: { upsert: vi.fn(), findMany: vi.fn() },
  profile: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@platform/db", () => ({ prisma: prismaMock }));

const syncActivitySetsMock = vi.hoisted(() => vi.fn());
vi.mock("./setSyncBack.js", () => ({ syncActivitySets: syncActivitySetsMock }));

import { dayKeysBetween, gramsToPounds, mapGarminActivity, syncUser } from "./sync.js";

const NOW = new Date("2026-07-10T18:00:00Z");

function fakeApi(overrides: Partial<GarminApi> = {}): GarminApi {
  return {
    getDisplayName: vi.fn().mockResolvedValue("user-hash"),
    getDailySummary: vi.fn().mockResolvedValue({
      steps: 8000,
      totalKilocalories: 2400,
      activeKilocalories: 600,
      restingHeartRate: 52,
    }),
    getSleepSeconds: vi.fn().mockResolvedValue(7 * 3600),
    getActivities: vi.fn().mockResolvedValue([]),
    getActivityExerciseSets: vi.fn().mockResolvedValue([]),
    getWeighIns: vi.fn().mockResolvedValue([]),
    pushWeight: vi.fn(),
    createStrengthWorkout: vi.fn(),
    scheduleWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    ...overrides,
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    lastSyncAt: null,
    lastSyncStatus: "never",
    updatedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.garminConnection.update.mockResolvedValue({});
  prismaMock.dailyWellness.upsert.mockResolvedValue({});
  prismaMock.activityLog.upsert.mockResolvedValue({});
  prismaMock.activityLog.findUnique.mockResolvedValue(null);
  prismaMock.progressLog.upsert.mockResolvedValue({});
  prismaMock.progressLog.findMany.mockResolvedValue([]);
  prismaMock.profile.findUnique.mockResolvedValue(null);
  syncActivitySetsMock.mockResolvedValue({ status: "synced" });
});

describe("helpers", () => {
  it("dayKeysBetween is inclusive", () => {
    expect(dayKeysBetween("2026-07-08", "2026-07-10")).toEqual([
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);
  });

  it("gramsToPounds converts and rounds to 0.1", () => {
    expect(gramsToPounds(81646.6)).toBe(180);
    expect(gramsToPounds(80000)).toBe(176.4);
  });

  it("mapGarminActivity converts units and parses GMT start time", () => {
    const mapped = mapGarminActivity({
      activityId: 42,
      activityName: "Morning Run",
      typeKey: "running",
      startTimeLocal: "2026-07-09 06:30:00",
      startTimeGMT: "2026-07-09 10:30:00",
      durationSeconds: 1830,
      distanceMeters: 5000,
      calories: 312.4,
    });
    expect(mapped).toEqual({
      activityName: "Morning Run",
      performedAt: new Date("2026-07-09T10:30:00Z"),
      durationMinutes: 31,
      activeCalories: 312,
      distanceMiles: 3.11,
      externalId: "42",
    });
  });

  it("mapGarminActivity falls back to a prettified type name", () => {
    const mapped = mapGarminActivity({
      activityId: 7,
      activityName: "",
      typeKey: "strength_training",
      startTimeLocal: "2026-07-09 06:30:00",
      startTimeGMT: "2026-07-09 10:30:00",
      durationSeconds: null,
      distanceMeters: null,
      calories: null,
    });
    expect(mapped.activityName).toBe("Strength Training");
    expect(mapped.durationMinutes).toBeNull();
  });
});

describe("syncUser", () => {
  it("skips when inside the cooldown window", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(
      connection({ lastSyncAt: new Date(NOW.getTime() - 5 * 60 * 1000), lastSyncStatus: "ok" }),
    );
    const api = fakeApi();
    const result = await syncUser("u1", api, { now: NOW });
    expect(result.skipped).toBe("cooldown");
    expect(api.getDailySummary).not.toHaveBeenCalled();
  });

  it("force bypasses the cooldown", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(
      connection({ lastSyncAt: new Date(NOW.getTime() - 5 * 60 * 1000), lastSyncStatus: "ok" }),
    );
    const result = await syncUser("u1", fakeApi(), { now: NOW, force: true });
    expect(result.skipped).toBeUndefined();
    expect(result.wellnessDays).toBeGreaterThan(0);
  });

  it("skips when another sync appears to be running", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(
      connection({ lastSyncStatus: "syncing", updatedAt: new Date(NOW.getTime() - 60 * 1000) }),
    );
    const result = await syncUser("u1", fakeApi(), { now: NOW, force: true });
    expect(result.skipped).toBe("already_syncing");
  });

  it("upserts activities keyed by garmin externalId", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    const api = fakeApi({
      getActivities: vi
        .fn()
        .mockResolvedValueOnce([
          {
            activityId: 99,
            activityName: "Evening Ride",
            typeKey: "cycling",
            startTimeLocal: "2026-07-09 18:00:00",
            startTimeGMT: "2026-07-09 22:00:00",
            durationSeconds: 3600,
            distanceMeters: 32000,
            calories: 800,
          },
        ])
        .mockResolvedValue([]),
    });
    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });
    expect(result.activitiesImported).toBe(1);
    expect(prismaMock.activityLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_source_externalId: { userId: "u1", source: "garmin", externalId: "99" },
        },
      }),
    );
  });

  it("stops paging once activities fall outside the window", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    const old = {
      activityId: 1,
      activityName: "Ancient Run",
      typeKey: "running",
      startTimeLocal: "2020-01-01 06:00:00",
      startTimeGMT: "2020-01-01 10:00:00",
      durationSeconds: 100,
      distanceMeters: 100,
      calories: 10,
    };
    const api = fakeApi({ getActivities: vi.fn().mockResolvedValue([old]) });
    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });
    expect(result.activitiesImported).toBe(0);
    expect(api.getActivities).toHaveBeenCalledTimes(1);
  });

  it("imports weigh-ins but skips echoes of manual logs", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    prismaMock.progressLog.findMany.mockResolvedValue([
      { loggedAt: new Date("2026-07-09T12:00:00Z"), weightLbs: 180 },
    ]);
    const api = fakeApi({
      getWeighIns: vi.fn().mockResolvedValue([
        // echo of the manual log above — must be skipped
        { samplePk: 1, dayKey: "2026-07-09", weightGrams: 81646.6 },
        // genuinely new weigh-in
        { samplePk: 2, dayKey: "2026-07-10", weightGrams: 81193 },
      ]),
    });
    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });
    expect(result.weightsImported).toBe(1);
    expect(prismaMock.progressLog.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.progressLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_source_externalId: { userId: "u1", source: "garmin", externalId: "2" },
        },
      }),
    );
  });

  function strengthActivity(id: number, startTimeGMT = "2026-07-09 14:00:00") {
    return {
      activityId: id,
      activityName: "Strength",
      typeKey: "strength_training",
      startTimeLocal: "2026-07-09 10:00:00",
      startTimeGMT,
      durationSeconds: 2400,
      distanceMeters: null,
      calories: 300,
    };
  }

  it("runs set sync-back for in-window strength activities only", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    const api = fakeApi({
      getActivities: vi
        .fn()
        .mockResolvedValueOnce([
          strengthActivity(11),
          {
            activityId: 12,
            activityName: "Evening Ride",
            typeKey: "cycling",
            startTimeLocal: "2026-07-09 18:00:00",
            startTimeGMT: "2026-07-09 22:00:00",
            durationSeconds: 3600,
            distanceMeters: 32000,
            calories: 800,
          },
        ])
        .mockResolvedValue([]),
    });

    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });

    expect(syncActivitySetsMock).toHaveBeenCalledTimes(1);
    expect(syncActivitySetsMock).toHaveBeenCalledWith(
      "u1",
      api,
      expect.objectContaining({ activityId: 11 }),
    );
    expect(result.setsSyncedActivities).toBe(1);
  });

  it("skips strength activities whose sets were already consumed", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    prismaMock.activityLog.findUnique.mockResolvedValue({ setsSyncedAt: new Date() });
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValueOnce([strengthActivity(11)]).mockResolvedValue([]),
    });

    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });

    expect(syncActivitySetsMock).not.toHaveBeenCalled();
    expect(result.setsSyncedActivities).toBe(0);
  });

  it("caps set sync-back fan-out per run, newest activities first", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    // Seven same-day strength activities, hour = activity id, all in window.
    const activities = [1, 2, 3, 4, 5, 6, 7].map((i) =>
      strengthActivity(i, `2026-07-09 0${i}:00:00`),
    );
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValueOnce(activities).mockResolvedValue([]),
    });

    await syncUser("u1", api, { now: NOW, backfillDays: 7 });

    expect(syncActivitySetsMock).toHaveBeenCalledTimes(5);
    // Newest first: activity 7 has the latest startTimeGMT.
    expect(syncActivitySetsMock.mock.calls[0]![2]).toEqual(
      expect.objectContaining({ activityId: 7 }),
    );
  });

  it("reports set sync-back failures without failing the sync", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    syncActivitySetsMock.mockRejectedValue(new Error("exerciseSets endpoint moved"));
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValueOnce([strengthActivity(11)]).mockResolvedValue([]),
    });

    const result = await syncUser("u1", api, { now: NOW, backfillDays: 3 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("setSync");
    expect(result.activitiesImported).toBe(1);
    expect(result.weightsImported).toBe(0);
  });

  it("records section failures without aborting the rest", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    const api = fakeApi({
      getDailySummary: vi.fn().mockRejectedValue(new Error("garmin down")),
      getActivities: vi.fn().mockResolvedValue([]),
    });
    const result = await syncUser("u1", api, { now: NOW, backfillDays: 2 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("wellness");
    // final status write marks the error
    const lastUpdate = prismaMock.garminConnection.update.mock.calls.at(-1)?.[0];
    expect(lastUpdate.data.lastSyncStatus).toBe("error");
  });

  it("marks status ok and stamps lastSyncAt on success", async () => {
    prismaMock.garminConnection.findUnique.mockResolvedValue(connection());
    const result = await syncUser("u1", fakeApi(), { now: NOW, backfillDays: 2 });
    expect(result.errors).toEqual([]);
    const lastUpdate = prismaMock.garminConnection.update.mock.calls.at(-1)?.[0];
    expect(lastUpdate.data.lastSyncStatus).toBe("ok");
    expect(lastUpdate.data.lastSyncAt).toEqual(NOW);
  });
});
