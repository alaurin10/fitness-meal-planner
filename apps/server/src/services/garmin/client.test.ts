import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real crypto.ts runs against a throwaway key so the encrypt→store path is
// genuinely exercised; only prisma and the garmin-connect client are mocked.
process.env.GARMIN_TOKEN_ENC_KEY = randomBytes(32).toString("base64");

const prismaMock = vi.hoisted(() => ({
  user: { upsert: vi.fn() },
  garminConnection: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@platform/db", () => ({ prisma: prismaMock }));

const gcMocks = vi.hoisted(() => ({
  loadToken: vi.fn(),
  getUserProfile: vi.fn(),
}));

vi.mock("garmin-connect", () => {
  class GarminConnect {
    loadToken = gcMocks.loadToken;
    getUserProfile = gcMocks.getUserProfile;
  }
  // client.ts consumes the CJS exports object via a default import.
  return { default: { GarminConnect } };
});

import {
  classifyGarminCallError,
  linkWithImportedTokens,
  normalizeExerciseSet,
  pickLatestWeighInPerDay,
} from "./client.js";
import { decryptJson } from "./crypto.js";
import { GarminAuthError, GarminUnavailableError, type StoredTokens } from "./types.js";

describe("pickLatestWeighInPerDay", () => {
  it("keeps only the highest-samplePk (latest) sample for a day with multiple readings", () => {
    // Real-world case: a smart scale sent a preliminary reading (195 lbs) 8
    // seconds before the final, settled one (165 lbs) — same calendar day.
    const metrics = [
      { samplePk: 1782768628292, weight: 88450, calendarDate: "2026-06-29" }, // ~195 lbs, earlier
      { samplePk: 1782768636346, weight: 74842, calendarDate: "2026-06-29" }, // ~165 lbs, later
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toEqual([
      { samplePk: 1782768636346, dayKey: "2026-06-29", weightGrams: 74842 },
    ]);
  });

  it("is order-independent — the later samplePk wins regardless of array order", () => {
    const metrics = [
      { samplePk: 1782768636346, weight: 74842, calendarDate: "2026-06-29" },
      { samplePk: 1782768628292, weight: 88450, calendarDate: "2026-06-29" },
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toEqual([
      { samplePk: 1782768636346, dayKey: "2026-06-29", weightGrams: 74842 },
    ]);
  });

  it("keeps one entry per distinct day", () => {
    const metrics = [
      { samplePk: 1, weight: 74000, calendarDate: "2026-06-28" },
      { samplePk: 2, weight: 74500, calendarDate: "2026-06-29" },
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.dayKey).sort()).toEqual(["2026-06-28", "2026-06-29"]);
  });

  it("filters out entries missing samplePk, weight, or calendarDate", () => {
    const metrics = [
      { samplePk: undefined, weight: 74000, calendarDate: "2026-06-29" },
      { samplePk: 1, weight: undefined, calendarDate: "2026-06-29" },
      { samplePk: 1, weight: 74000, calendarDate: undefined },
    ];

    expect(pickLatestWeighInPerDay(metrics)).toEqual([]);
  });

  it("returns an empty array for no metrics", () => {
    expect(pickLatestWeighInPerDay([])).toEqual([]);
  });
});

describe("normalizeExerciseSet", () => {
  it("keeps the highest-probability exercise identification", () => {
    const set = normalizeExerciseSet({
      exercises: [
        { category: "CURL", name: "DUMBBELL_BICEPS_CURL", probability: 33 },
        { category: "BENCH_PRESS", name: "BARBELL_BENCH_PRESS", probability: 67 },
      ],
      setType: "ACTIVE",
      repetitionCount: 8,
      weight: 61234,
      duration: 41.2,
      startTime: "2026-07-20T14:03:11.0",
      wkStepIndex: 2,
    });

    expect(set).toEqual({
      setType: "ACTIVE",
      category: "BENCH_PRESS",
      name: "BARBELL_BENCH_PRESS",
      reps: 8,
      weightGrams: 61234,
      durationSeconds: 41.2,
      startTimeGMT: "2026-07-20T14:03:11.0",
      wkStepIndex: 2,
    });
  });

  it("nulls out everything Garmin didn't send (unrecognized freeform set)", () => {
    expect(normalizeExerciseSet({ exercises: [], setType: "ACTIVE" })).toEqual({
      setType: "ACTIVE",
      category: null,
      name: null,
      reps: null,
      weightGrams: null,
      durationSeconds: null,
      startTimeGMT: null,
      wkStepIndex: null,
    });
  });

  it("passes REST sets through with null weight/reps intact", () => {
    const set = normalizeExerciseSet({ setType: "REST", duration: 90 });
    expect(set.setType).toBe("REST");
    expect(set.durationSeconds).toBe(90);
    expect(set.reps).toBeNull();
    expect(set.weightGrams).toBeNull();
  });
});

function validImport() {
  return {
    oauth1: { oauth_token: "OT-1", oauth_token_secret: "OTS-1" },
    oauth2: {
      access_token: "AT-1",
      refresh_token: "RT-1",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token_expires_in: 7776000,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.upsert.mockResolvedValue({});
  prismaMock.garminConnection.upsert.mockResolvedValue({});
  gcMocks.getUserProfile.mockResolvedValue({ displayName: "dn-1" });
});

describe("linkWithImportedTokens", () => {
  it.each([
    ["null", null],
    ["a string", "not-tokens"],
    ["an empty object", {}],
    ["oauth1 missing the secret", { ...validImport(), oauth1: { oauth_token: "OT-1" } }],
    ["oauth2 missing the refresh token", { ...validImport(), oauth2: { access_token: "AT-1" } }],
  ])("rejects %s without calling Garmin or storing anything", async (_label, raw) => {
    await expect(linkWithImportedTokens("u1", raw)).rejects.toBeInstanceOf(GarminAuthError);
    expect(gcMocks.getUserProfile).not.toHaveBeenCalled();
    expect(prismaMock.garminConnection.upsert).not.toHaveBeenCalled();
  });

  it("rejects tokens Garmin turns down, without storing them", async () => {
    gcMocks.getUserProfile.mockRejectedValue(new Error("Request failed with status code 401"));

    await expect(linkWithImportedTokens("u1", validImport())).rejects.toBeInstanceOf(
      GarminAuthError,
    );
    expect(prismaMock.garminConnection.upsert).not.toHaveBeenCalled();
  });

  it("verifies, stamps expiry fields, encrypts, and stores valid tokens", async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await linkWithImportedTokens("u1", validImport());

    expect(result.garminUserId).toBe("dn-1");
    // Verification really loaded the (expiry-stamped) tokens into the client.
    expect(gcMocks.loadToken).toHaveBeenCalledWith(
      { oauth_token: "OT-1", oauth_token_secret: "OTS-1" },
      expect.objectContaining({ access_token: "AT-1" }),
    );

    expect(prismaMock.user.upsert).toHaveBeenCalled();
    const upsert = prismaMock.garminConnection.upsert.mock.calls[0]![0] as {
      create: { encryptedTokens: string; garminUserId: string | null };
    };
    expect(upsert.create.garminUserId).toBe("dn-1");
    const stored = decryptJson<StoredTokens>(upsert.create.encryptedTokens);
    expect(stored.oauth1).toEqual({ oauth_token: "OT-1", oauth_token_secret: "OTS-1" });
    expect(stored.oauth2.refresh_token).toBe("RT-1");
    // Derived fields garmin-connect's refresh logic reads must be stamped.
    expect(stored.oauth2.expires_at).toBeGreaterThanOrEqual(before + 3600);
    expect(stored.oauth2.refresh_token_expires_at).toBeGreaterThan(stored.oauth2.expires_at);
  });

  it("keeps existing expiry fields (e.g. a garth export) instead of restamping", async () => {
    const raw = validImport();
    (raw.oauth2 as Record<string, unknown>).expires_at = 1234;

    await linkWithImportedTokens("u1", raw);

    const upsert = prismaMock.garminConnection.upsert.mock.calls[0]![0] as {
      create: { encryptedTokens: string };
    };
    const stored = decryptJson<StoredTokens>(upsert.create.encryptedTokens);
    expect(stored.oauth2.expires_at).toBe(1234);
  });
});

describe("classifyGarminCallError", () => {
  it("treats rate limiting as unavailable, never as an auth failure", () => {
    expect(
      classifyGarminCallError(new Error("Request failed with status code 429")),
    ).toBeInstanceOf(GarminUnavailableError);
    // Regression: a throttled internal token refresh used to match the auth
    // regex (via "refresh") and demand a needless reconnect.
    expect(
      classifyGarminCallError(new Error("Could not refresh oauth2 token: Too Many Requests")),
    ).toBeInstanceOf(GarminUnavailableError);
  });

  it("maps genuine auth failures to GarminAuthError", () => {
    expect(
      classifyGarminCallError(new Error("Request failed with status code 401")),
    ).toBeInstanceOf(GarminAuthError);
    expect(classifyGarminCallError(new Error("Refresh token is invalid"))).toBeInstanceOf(
      GarminAuthError,
    );
  });

  it("maps everything else to GarminUnavailableError", () => {
    expect(classifyGarminCallError(new Error("socket hang up"))).toBeInstanceOf(
      GarminUnavailableError,
    );
  });
});
