import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GarminApi, GarminExerciseSet } from "./types.js";

const prismaMock = vi.hoisted(() => ({
  userSettings: { findUnique: vi.fn() },
  weeklyPlan: { findFirst: vi.fn() },
  workoutCompletion: { findUnique: vi.fn(), upsert: vi.fn() },
  activityLog: { update: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@platform/db", () => ({ prisma: prismaMock }));

import {
  checkWatchSession,
  matchGarminSetsToPlan,
  resetWatchCheckThrottle,
  syncActivitySets,
  WATCH_CHECK_MIN_INTERVAL_MS,
  type MatchExercise,
} from "./setSyncBack.js";

const NOW = new Date("2026-07-20T15:00:00Z");

function gSet(overrides: Partial<GarminExerciseSet> = {}): GarminExerciseSet {
  return {
    setType: "ACTIVE",
    category: "BENCH_PRESS",
    name: null,
    reps: 8,
    weightGrams: 60000,
    durationSeconds: 40,
    startTimeGMT: null,
    wkStepIndex: null,
    ...overrides,
  };
}

function fakeApi(overrides: Partial<GarminApi> = {}): GarminApi {
  return {
    getDisplayName: vi.fn().mockResolvedValue("user-hash"),
    getDailySummary: vi.fn(),
    getSleepSeconds: vi.fn(),
    getActivities: vi.fn().mockResolvedValue([]),
    getActivityExerciseSets: vi.fn().mockResolvedValue([]),
    getWeighIns: vi.fn(),
    pushWeight: vi.fn(),
    createStrengthWorkout: vi.fn(),
    scheduleWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    ...overrides,
  };
}

// 2026-07-20 is a Monday; weekStartDay defaults to Mon so the plan week is the same day.
const planJson = {
  summary: "s",
  progressionNotes: "p",
  days: [
    {
      day: "Mon",
      focus: "Push",
      exercises: [
        { name: "Bench Press", muscleGroup: "chest", description: "d", sets: 3, reps: "8", loadLbs: 135, restSeconds: 90, type: "strength" },
        { name: "Row", muscleGroup: "back", description: "d", sets: 2, reps: "10", loadLbs: 95, restSeconds: 60, type: "strength" },
      ],
    },
  ],
};

describe("matchGarminSetsToPlan", () => {
  const exercises: MatchExercise[] = [
    { name: "Bench Press", sets: 3 },
    { name: "Row", sets: 3 },
    { name: "Curl", sets: 2 },
  ];

  it("matches an in-order full session by category", () => {
    const sets = [
      ...Array.from({ length: 3 }, () => gSet({ category: "BENCH_PRESS" })),
      ...Array.from({ length: 3 }, () => gSet({ category: "ROW" })),
      ...Array.from({ length: 2 }, () => gSet({ category: "CURL" })),
    ];
    expect(matchGarminSetsToPlan(exercises, sets)).toEqual({
      delta: { "0": [1, 2, 3], "1": [1, 2, 3], "2": [1, 2] },
      matchedSets: 8,
      unmatchedSets: 0,
    });
  });

  it("ignores REST sets and zero-work sets", () => {
    const sets = [
      gSet({ category: "BENCH_PRESS" }),
      gSet({ setType: "REST", reps: null, durationSeconds: 90 }),
      gSet({ category: "BENCH_PRESS", reps: null, durationSeconds: null }),
    ];
    const result = matchGarminSetsToPlan(exercises, sets);
    expect(result.delta).toEqual({ "0": [1] });
    expect(result.matchedSets).toBe(1);
  });

  it("caps extra sets at the planned count", () => {
    const sets = Array.from({ length: 5 }, () => gSet({ category: "BENCH_PRESS" }));
    const result = matchGarminSetsToPlan(exercises, sets);
    expect(result.delta).toEqual({ "0": [1, 2, 3] });
    expect(result.matchedSets).toBe(3);
  });

  it("returns a partial delta when fewer sets were done", () => {
    const sets = [gSet({ category: "ROW" }), gSet({ category: "ROW" })];
    expect(matchGarminSetsToPlan(exercises, sets).delta).toEqual({ "1": [1, 2] });
  });

  it("matches out-of-order exercises by category", () => {
    const sets = [
      gSet({ category: "CURL" }),
      gSet({ category: "CURL" }),
      gSet({ category: "BENCH_PRESS" }),
    ];
    expect(matchGarminSetsToPlan(exercises, sets).delta).toEqual({ "0": [1], "2": [1, 2] });
  });

  it("pairs unidentified sets only with taxonomy-unmapped plan exercises", () => {
    const withUnmapped: MatchExercise[] = [
      { name: "Bench Press", sets: 3 },
      { name: "Farmer Carry", sets: 2 }, // not in EXERCISE_TAXONOMY
    ];
    const result = matchGarminSetsToPlan(withUnmapped, [gSet({ category: null })]);
    expect(result.delta).toEqual({ "1": [1] });
    expect(result.unmatchedSets).toBe(0);
  });

  it("counts unidentified sets as unmatched when every plan exercise is mapped", () => {
    const result = matchGarminSetsToPlan(exercises, [gSet({ category: null })]);
    expect(result.delta).toEqual({});
    expect(result.unmatchedSets).toBe(1);
  });

  it("counts sets with a category no plan exercise has as unmatched", () => {
    const result = matchGarminSetsToPlan(exercises, [gSet({ category: "OLYMPIC_LIFT" })]);
    expect(result.delta).toEqual({});
    expect(result.unmatchedSets).toBe(1);
  });

  it("fills two same-category exercises in plan order", () => {
    const siblings: MatchExercise[] = [
      { name: "Bench Press", sets: 3 },
      { name: "Incline Bench Press", sets: 3 },
    ];
    const sets = Array.from({ length: 6 }, () => gSet({ category: "BENCH_PRESS" }));
    expect(matchGarminSetsToPlan(siblings, sets).delta).toEqual({
      "0": [1, 2, 3],
      "1": [1, 2, 3],
    });
  });

  it("prefers an exact taxonomy-name match over plan order", () => {
    const siblings: MatchExercise[] = [
      { name: "Bench Press", sets: 1 }, // BARBELL_BENCH_PRESS
      { name: "Incline Bench Press", sets: 1 }, // INCLINE_BARBELL_BENCH_PRESS
    ];
    const result = matchGarminSetsToPlan(siblings, [
      gSet({ category: "BENCH_PRESS", name: "INCLINE_BARBELL_BENCH_PRESS" }),
    ]);
    expect(result.delta).toEqual({ "1": [1] });
  });

  it("matches a cardio block by a time-only set", () => {
    const withCardio: MatchExercise[] = [
      { name: "Bench Press", sets: 3 },
      { name: "Treadmill Run", sets: 1, type: "cardio", durationMinutes: 15 },
    ];
    const result = matchGarminSetsToPlan(withCardio, [
      gSet({ category: null, reps: null, durationSeconds: 900 }),
    ]);
    expect(result.delta).toEqual({ "1": [1] });
  });

  describe("wkStepIndex pass", () => {
    // Flat step list for bench(3 sets) + row(2 sets):
    // 0 int(b,1) 1 rest 2 int(b,2) 3 rest 4 int(b,3) 5 rest 6 int(r,1) 7 rest 8 int(r,2)
    const two: MatchExercise[] = [
      { name: "Bench Press", sets: 3 },
      { name: "Row", sets: 2 },
    ];

    it("maps 0-based step indices directly to (exercise, set) positions", () => {
      const sets = [0, 2, 4, 6, 8].map((wkStepIndex) =>
        gSet({ category: null, wkStepIndex }),
      );
      expect(matchGarminSetsToPlan(two, sets)).toEqual({
        delta: { "0": [1, 2, 3], "1": [1, 2] },
        matchedSets: 5,
        unmatchedSets: 0,
      });
    });

    it("maps 1-based step indices via the interpretation probe", () => {
      const sets = [1, 3, 5, 7, 9].map((wkStepIndex) =>
        gSet({ category: null, wkStepIndex }),
      );
      expect(matchGarminSetsToPlan(two, sets).delta).toEqual({ "0": [1, 2, 3], "1": [1, 2] });
    });

    it("preserves exact set positions for a partial watch session", () => {
      // Only sets 1 and 3 of bench were done — positions survive, no renumbering.
      const sets = [0, 4].map((wkStepIndex) => gSet({ category: null, wkStepIndex }));
      expect(matchGarminSetsToPlan(two, sets).delta).toEqual({ "0": [1, 3] });
    });

    it("falls back to category matching when indices fit no interpretation", () => {
      const sets = [
        gSet({ category: "BENCH_PRESS", wkStepIndex: 40 }),
        gSet({ category: "ROW", wkStepIndex: 50 }),
      ];
      expect(matchGarminSetsToPlan(two, sets).delta).toEqual({ "0": [1], "1": [1] });
    });

    it("falls back to category matching when any set lacks an index", () => {
      const sets = [
        gSet({ category: "BENCH_PRESS", wkStepIndex: 0 }),
        gSet({ category: "BENCH_PRESS", wkStepIndex: null }),
      ];
      expect(matchGarminSetsToPlan(two, sets).delta).toEqual({ "0": [1, 2] });
    });
  });
});

describe("syncActivitySets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userSettings.findUnique.mockResolvedValue(null);
    prismaMock.weeklyPlan.findFirst.mockResolvedValue({ id: "p1", planJson });
    prismaMock.workoutCompletion.findUnique.mockResolvedValue(null);
    prismaMock.workoutCompletion.upsert.mockImplementation(({ update }) =>
      Promise.resolve({ id: "wc1", ...update }),
    );
    prismaMock.activityLog.update.mockResolvedValue({});
  });

  const activity = { activityId: 500, startTimeLocal: "2026-07-20 09:00:00" };

  it("skips (and stamps) when no plan exists for the activity's week", async () => {
    prismaMock.weeklyPlan.findFirst.mockResolvedValue(null);
    const api = fakeApi();

    const result = await syncActivitySets("u1", api, activity);

    expect(result).toEqual({ status: "skipped", reason: "no_plan_day" });
    expect(api.getActivityExerciseSets).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { setsSyncedAt: expect.any(Date) } }),
    );
  });

  it("skips without stamping when Garmin has no set data yet, so a later sync retries", async () => {
    const api = fakeApi({ getActivityExerciseSets: vi.fn().mockResolvedValue([]) });

    const result = await syncActivitySets("u1", api, activity);

    expect(result).toEqual({ status: "skipped", reason: "no_sets" });
    expect(prismaMock.activityLog.update).not.toHaveBeenCalled();
  });

  it("merges watch sets into the completion without removing phone-marked sets", async () => {
    prismaMock.workoutCompletion.findUnique.mockResolvedValue({
      setsJson: { "1": [1] }, // user already ticked Row set 1 on the phone
      completedAt: null,
    });
    const api = fakeApi({
      getActivityExerciseSets: vi.fn().mockResolvedValue([
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "ROW" }),
        gSet({ category: "ROW" }),
      ]),
    });

    const result = await syncActivitySets("u1", api, activity);

    expect(result.status).toBe("synced");
    if (result.status !== "synced") return;
    expect(result.matchedSets).toBe(5);
    expect(result.totalPlannedSets).toBe(5);
    const upsert = prismaMock.workoutCompletion.upsert.mock.calls[0]![0];
    expect(upsert.update.setsJson).toEqual({ "0": [1, 2, 3], "1": [1, 2] });
    expect(upsert.update.completedAt).toBeInstanceOf(Date);
    expect(prismaMock.activityLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_source_externalId: { userId: "u1", source: "garmin", externalId: "500" },
        },
      }),
    );
  });

  it("is idempotent — re-running produces the same stored setsJson", async () => {
    prismaMock.workoutCompletion.findUnique.mockResolvedValue({
      setsJson: { "0": [1, 2, 3], "1": [1, 2] },
      completedAt: new Date("2026-07-20T10:00:00Z"),
    });
    const api = fakeApi({
      getActivityExerciseSets: vi.fn().mockResolvedValue([
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "ROW" }),
        gSet({ category: "ROW" }),
      ]),
    });

    await syncActivitySets("u1", api, activity);

    const upsert = prismaMock.workoutCompletion.upsert.mock.calls[0]![0];
    expect(upsert.update.setsJson).toEqual({ "0": [1, 2, 3], "1": [1, 2] });
    expect(upsert.update.completedAt).toEqual(new Date("2026-07-20T10:00:00Z"));
  });
});

describe("checkWatchSession", () => {
  const strengthActivity = {
    activityId: 500,
    activityName: "Strength",
    typeKey: "strength_training",
    startTimeLocal: "2026-07-20 09:00:00",
    startTimeGMT: "2026-07-20 13:00:00",
    durationSeconds: 2400,
    distanceMeters: null,
    calories: 300.4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetWatchCheckThrottle();
    prismaMock.userSettings.findUnique.mockResolvedValue(null);
    prismaMock.weeklyPlan.findFirst.mockResolvedValue({ id: "p1", planJson });
    prismaMock.workoutCompletion.findUnique.mockResolvedValue(null);
    prismaMock.workoutCompletion.upsert.mockImplementation(({ update }) =>
      Promise.resolve({ id: "wc1", ...update }),
    );
    prismaMock.activityLog.update.mockResolvedValue({});
    prismaMock.activityLog.upsert.mockResolvedValue({});
  });

  it("returns null for a plan the user does not own", async () => {
    prismaMock.weeklyPlan.findFirst.mockResolvedValue(null);
    expect(
      await checkWatchSession("u1", fakeApi(), { planId: "px", dayKey: "2026-07-20" }, NOW),
    ).toBeNull();
  });

  it("reports waiting when no strength activity exists for the day", async () => {
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValue([
        { ...strengthActivity, typeKey: "running" },
        { ...strengthActivity, startTimeLocal: "2026-07-19 09:00:00" },
      ]),
    });

    const result = await checkWatchSession("u1", api, { planId: "p1", dayKey: "2026-07-20" }, NOW);

    expect(result).toEqual({ status: "waiting", madeGarminCall: true });
    expect(api.getActivityExerciseSets).not.toHaveBeenCalled();
  });

  it("throttles repeat polls to one real Garmin call per interval", async () => {
    const api = fakeApi();

    await checkWatchSession("u1", api, { planId: "p1", dayKey: "2026-07-20" }, NOW);
    const second = await checkWatchSession(
      "u1",
      api,
      { planId: "p1", dayKey: "2026-07-20" },
      new Date(NOW.getTime() + WATCH_CHECK_MIN_INTERVAL_MS / 2),
    );
    const third = await checkWatchSession(
      "u1",
      api,
      { planId: "p1", dayKey: "2026-07-20" },
      new Date(NOW.getTime() + WATCH_CHECK_MIN_INTERVAL_MS + 1000),
    );

    expect(api.getActivities).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ status: "waiting", madeGarminCall: false });
    expect(third?.madeGarminCall).toBe(true);
  });

  it("finds the day's strength activity, syncs its sets, and returns the completion", async () => {
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValue([strengthActivity]),
      getActivityExerciseSets: vi.fn().mockResolvedValue([
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "BENCH_PRESS" }),
        gSet({ category: "ROW" }),
        gSet({ category: "ROW" }),
      ]),
    });

    const result = await checkWatchSession("u1", api, { planId: "p1", dayKey: "2026-07-20" }, NOW);

    expect(result?.status).toBe("found");
    if (result?.status !== "found") return;
    expect(result.activity).toEqual({
      activityId: "500",
      activityName: "Strength",
      durationMinutes: 40,
      calories: 300,
    });
    expect(result.matchedSets).toBe(5);
    expect(result.totalPlannedSets).toBe(5);
    expect(result.completion.setsJson).toEqual({ "0": [1, 2, 3], "1": [1, 2] });
    expect(result.completion.completedAt).toBeInstanceOf(Date);
    // The activity is recorded immediately so the app's activity list is
    // consistent even before the next routine sync.
    expect(prismaMock.activityLog.upsert).toHaveBeenCalled();
  });

  it("keeps waiting when the activity exists but set data is not consumable yet", async () => {
    const api = fakeApi({
      getActivities: vi.fn().mockResolvedValue([strengthActivity]),
      getActivityExerciseSets: vi.fn().mockResolvedValue([]),
    });

    const result = await checkWatchSession("u1", api, { planId: "p1", dayKey: "2026-07-20" }, NOW);

    expect(result).toEqual({ status: "waiting", madeGarminCall: true });
  });
});
