import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  workoutCompletion: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@platform/db", () => ({ prisma: prismaMock }));

import {
  dayLabelForDayKey,
  isAllDone,
  mergeSetsJson,
  sanitizeSetsJson,
  upsertMergedCompletion,
} from "./workoutCompletion.js";

describe("dayLabelForDayKey", () => {
  it("maps dayKeys to day labels across a week boundary", () => {
    expect(dayLabelForDayKey("2026-07-20")).toBe("Mon");
    expect(dayLabelForDayKey("2026-07-26")).toBe("Sun");
    expect(dayLabelForDayKey("2026-07-27")).toBe("Mon");
  });
});

describe("sanitizeSetsJson", () => {
  const exercises = [{ sets: 3 }, { sets: 2 }];

  it("drops keys outside the day's exercise range", () => {
    expect(sanitizeSetsJson({ "0": [1], "5": [1], "-1": [1], "x": [1] }, exercises)).toEqual({
      "0": [1],
    });
  });

  it("clamps set numbers to the exercise's planned range and dedupes/sorts", () => {
    expect(sanitizeSetsJson({ "0": [3, 1, 1, 4, 0], "1": [2, 9] }, exercises)).toEqual({
      "0": [1, 3],
      "1": [2],
    });
  });

  it("omits exercises left with no valid sets", () => {
    expect(sanitizeSetsJson({ "0": [99] }, exercises)).toEqual({});
  });
});

describe("isAllDone", () => {
  const exercises = [{ sets: 2 }, { sets: 1 }];

  it("is true when every exercise reaches its planned set count", () => {
    expect(isAllDone({ "0": [1, 2], "1": [1] }, exercises)).toBe(true);
  });

  it("is false when any exercise is short", () => {
    expect(isAllDone({ "0": [1], "1": [1] }, exercises)).toBe(false);
    expect(isAllDone({}, exercises)).toBe(false);
  });
});

describe("mergeSetsJson", () => {
  it("unions per exercise and sorts", () => {
    expect(mergeSetsJson({ "0": [1, 3] }, { "0": [2, 3], "1": [1] })).toEqual({
      "0": [1, 2, 3],
      "1": [1],
    });
  });

  it("is idempotent", () => {
    const base = { "0": [1, 2] };
    expect(mergeSetsJson(base, base)).toEqual(base);
  });

  it("never removes sets from the base", () => {
    expect(mergeSetsJson({ "0": [1, 2, 3] }, {})).toEqual({ "0": [1, 2, 3] });
  });
});

describe("upsertMergedCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.workoutCompletion.upsert.mockImplementation(({ update }) =>
      Promise.resolve({ id: "wc1", ...update }),
    );
  });

  it("merges the delta into an existing row without removing phone-marked sets", async () => {
    prismaMock.workoutCompletion.findUnique.mockResolvedValue({
      setsJson: { "0": [1, 3] },
      completedAt: null,
    });

    await upsertMergedCompletion("u1", "p1", "2026-07-20", { "0": [1, 2] }, [{ sets: 3 }]);

    const upsert = prismaMock.workoutCompletion.upsert.mock.calls[0]![0];
    expect(upsert.update.setsJson).toEqual({ "0": [1, 2, 3] });
    expect(upsert.update.completedAt).toBeInstanceOf(Date);
  });

  it("leaves completedAt null when the merge does not finish the day", async () => {
    prismaMock.workoutCompletion.findUnique.mockResolvedValue(null);

    await upsertMergedCompletion("u1", "p1", "2026-07-20", { "0": [1] }, [{ sets: 3 }]);

    const upsert = prismaMock.workoutCompletion.upsert.mock.calls[0]![0];
    expect(upsert.update.setsJson).toEqual({ "0": [1] });
    expect(upsert.update.completedAt).toBeNull();
  });

  it("preserves an existing completedAt timestamp", async () => {
    const stamped = new Date("2026-07-20T10:00:00Z");
    prismaMock.workoutCompletion.findUnique.mockResolvedValue({
      setsJson: { "0": [1, 2, 3] },
      completedAt: stamped,
    });

    await upsertMergedCompletion("u1", "p1", "2026-07-20", { "0": [1] }, [{ sets: 3 }]);

    const upsert = prismaMock.workoutCompletion.upsert.mock.calls[0]![0];
    expect(upsert.update.completedAt).toBe(stamped);
  });
});
