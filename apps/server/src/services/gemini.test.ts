import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Disable per-model backoff sleeps before the module computes ATTEMPTS_PER_MODEL,
// so the retry tests run instantly (one attempt per model, no waits).
let g: typeof import("./gemini.js");
beforeAll(async () => {
  process.env.GEMINI_RETRIES = "1";
  g = await import("./gemini.js");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stripJsonFences", () => {
  it("returns plain JSON untouched", () => {
    expect(g.stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });
  it("strips ```json fences", () => {
    expect(g.stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("strips bare ``` fences", () => {
    expect(g.stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("parseGeminiJson", () => {
  it("parses valid JSON", () => {
    expect(g.parseGeminiJson('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });
  it("parses fenced JSON", () => {
    expect(g.parseGeminiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("repairs malformed JSON (trailing comma)", () => {
    expect(g.parseGeminiJson('{"a":1,}')).toEqual({ a: 1 });
  });
  it("repairs unquoted keys and single quotes (common LLM glitches)", () => {
    expect(g.parseGeminiJson("{a: 1}")).toEqual({ a: 1 });
    expect(g.parseGeminiJson("{'a': 'b'}")).toEqual({ a: "b" });
  });
});

describe("getModels", () => {
  it("falls back to defaults when env is unset", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "");
    const models = g.getModels();
    expect(models[0]).toBe("gemini-3.5-flash");
    expect(models.length).toBeGreaterThan(1);
  });
  it("honors env overrides and preserves order", () => {
    vi.stubEnv("GEMINI_MODEL", "primary");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "fb1, fb2 ,fb3");
    expect(g.getModels()).toEqual(["primary", "fb1", "fb2", "fb3"]);
  });
  it("de-dupes while preserving order", () => {
    vi.stubEnv("GEMINI_MODEL", "m");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "m,n,n,m");
    expect(g.getModels()).toEqual(["m", "n"]);
  });
});

describe("getGeminiErrorMessage", () => {
  it("reads an Error message", () => {
    expect(g.getGeminiErrorMessage(new Error("boom"))).toBe("boom");
  });
  it("reads a nested error.message", () => {
    expect(g.getGeminiErrorMessage({ error: { message: "nested" } })).toBe("nested");
  });
  it("falls back for unrecognized shapes", () => {
    expect(g.getGeminiErrorMessage(42)).toBe("Gemini request failed");
  });
});

describe("generateWithRetry", () => {
  it("resolves on the first successful attempt", async () => {
    vi.stubEnv("GEMINI_MODEL", "m1");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "m2");
    const fn = vi.fn(async (model: string) => `ok:${model}`);
    await expect(g.generateWithRetry(fn)).resolves.toBe("ok:m1");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propagates non-retryable errors immediately", async () => {
    vi.stubEnv("GEMINI_MODEL", "m1");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "m2");
    const fn = vi.fn(async () => {
      throw new Error("invalid api key");
    });
    await expect(g.generateWithRetry(fn)).rejects.toThrow("invalid api key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next model on a transient error", async () => {
    vi.stubEnv("GEMINI_MODEL", "m1");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "m2");
    const fn = vi.fn(async (model: string) => {
      if (model === "m1") throw new Error("503 Service Unavailable");
      return `ok:${model}`;
    });
    await expect(g.generateWithRetry(fn)).resolves.toBe("ok:m2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries GenerationSkipError across models then throws a friendly error", async () => {
    vi.stubEnv("GEMINI_MODEL", "m1");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "m2,m3");
    const fn = vi.fn(async () => {
      throw new g.GenerationSkipError("bad json");
    });
    await expect(g.generateWithRetry(fn)).rejects.toThrow(/temporarily unavailable/i);
    // One attempt per model (GEMINI_RETRIES=1): m1, m2, m3.
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
