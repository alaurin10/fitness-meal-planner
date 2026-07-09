import { FinishReason, GoogleGenAI } from "@google/genai";
import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import { jsonrepair } from "jsonrepair";

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemma-4-31b-it",
];

/**
 * Model selection is env-driven so a retired/renamed model can be swapped
 * without a code change. `GEMINI_MODEL` is the primary; `GEMINI_FALLBACK_MODELS`
 * is a comma-separated list tried in order when the primary fails.
 */
function parseModelList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

export function getModels(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = parseModelList(process.env.GEMINI_FALLBACK_MODELS);
  const models = [primary, ...(fallbacks.length ? fallbacks : DEFAULT_FALLBACK_MODELS)];
  // De-dupe while preserving order.
  return [...new Set(models)];
}

// Per-call wall-clock timeout. Full-week meal plans are large, so this is
// generous by default but bounded so a hung request can't pin a worker.
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90_000;
// Attempts per model before advancing to the next fallback (includes the first try).
const ATTEMPTS_PER_MODEL = Math.max(1, Number(process.env.GEMINI_RETRIES) || 2);

// Kept for back-compat with callers that still reference it.
export const GEMINI_MODEL = DEFAULT_MODEL;

export class GenerationSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationSkipError";
  }
}

/** Raised when a single Gemini call exceeds TIMEOUT_MS. Treated as transient. */
export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiTimeoutError";
  }
}

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function isUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  return msg.includes("503") || msg.toLowerCase().includes("unavailable");
}

function isQuotaExhausted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  return msg.includes("429") || msg.toLowerCase().includes("resource_exhausted") || msg.toLowerCase().includes("quota");
}

/** Transient errors are worth retrying (same model, then fallbacks). */
function isTransient(error: unknown): boolean {
  return error instanceof GeminiTimeoutError || isUnavailable(error) || isQuotaExhausted(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with full jitter, capped at 8s. */
function backoffMs(attempt: number): number {
  const base = Math.min(8_000, 400 * 2 ** (attempt - 1));
  return Math.round(base / 2 + Math.random() * (base / 2));
}

interface GenerationLog {
  model: string;
  attempt: number;
  latencyMs: number;
  outcome: "ok" | "timeout" | "transient" | "bad_response" | "error";
  finishReason?: FinishReason | string;
  usage?: GenerateContentResponseUsageMetadata;
  detail?: string;
}

/** One structured JSON log line per attempt — usable for basic observability. */
function logGeneration(entry: GenerationLog): void {
  const payload = {
    tag: "gemini",
    model: entry.model,
    attempt: entry.attempt,
    latencyMs: entry.latencyMs,
    outcome: entry.outcome,
    finishReason: entry.finishReason,
    promptTokens: entry.usage?.promptTokenCount,
    outputTokens: entry.usage?.candidatesTokenCount,
    totalTokens: entry.usage?.totalTokenCount,
    detail: entry.detail,
  };
  const line = JSON.stringify(payload);
  if (entry.outcome === "ok") {
    console.info(line);
  } else {
    console.warn(line);
  }
}

export interface GeminiCallOptions {
  model: string;
  systemInstruction: string;
  contents: string;
  /** Native Gemini response schema (see geminiSchemas.ts). */
  responseSchema?: unknown;
  maxOutputTokens: number;
  /** Sampling temperature; omitted = model default. */
  temperature?: number;
  /** For log correlation only. */
  attempt?: number;
}

/**
 * Generation temperature: GEMINI_TEMPERATURE env override, else the caller's
 * fallback. Higher values push Gemini toward more varied meal plans.
 */
export function defaultTemperature(fallback = 0.9): number {
  const v = Number(process.env.GEMINI_TEMPERATURE);
  return Number.isFinite(v) && v > 0 && v <= 2 ? v : fallback;
}

/**
 * Single Gemini generation call with a hard timeout, native structured-output
 * schema, truncation detection, JSON parsing, and structured logging. Returns
 * the parsed (but not yet Zod-validated) JSON. Throws:
 *  - GeminiTimeoutError on timeout (transient → retried)
 *  - GenerationSkipError on truncation / empty / unparseable output (retried)
 *  - the raw API error otherwise (classified by the retry loop)
 */
export async function callGemini(opts: GeminiCallOptions): Promise<unknown> {
  const attempt = opts.attempt ?? 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await getGeminiClient().models.generateContent({
      model: opts.model,
      config: {
        maxOutputTokens: opts.maxOutputTokens,
        responseMimeType: "application/json",
        ...(opts.responseSchema ? { responseSchema: opts.responseSchema as never } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        systemInstruction: opts.systemInstruction,
        abortSignal: controller.signal,
      },
      contents: opts.contents,
    });

    const latencyMs = Date.now() - started;
    const finishReason = response.candidates?.[0]?.finishReason;

    if (finishReason === FinishReason.MAX_TOKENS) {
      logGeneration({ model: opts.model, attempt, latencyMs, outcome: "bad_response", finishReason, usage: response.usageMetadata, detail: "truncated" });
      throw new GenerationSkipError("Gemini response was truncated (MAX_TOKENS)");
    }
    if (!response.text) {
      logGeneration({ model: opts.model, attempt, latencyMs, outcome: "bad_response", finishReason, usage: response.usageMetadata, detail: "empty" });
      throw new GenerationSkipError("Gemini returned no text content");
    }

    let parsed: unknown;
    try {
      parsed = parseGeminiJson(response.text);
    } catch (err) {
      logGeneration({ model: opts.model, attempt, latencyMs, outcome: "bad_response", finishReason, usage: response.usageMetadata, detail: "unparseable_json" });
      throw new GenerationSkipError(`Gemini returned invalid JSON: ${(err as Error).message}`);
    }

    logGeneration({ model: opts.model, attempt, latencyMs, outcome: "ok", finishReason, usage: response.usageMetadata });
    return parsed;
  } catch (err) {
    if (controller.signal.aborted) {
      logGeneration({ model: opts.model, attempt, latencyMs: Date.now() - started, outcome: "timeout" });
      throw new GeminiTimeoutError(`Gemini call timed out after ${TIMEOUT_MS}ms`);
    }
    if (err instanceof GenerationSkipError) throw err;
    logGeneration({
      model: opts.model,
      attempt,
      latencyMs: Date.now() - started,
      outcome: isTransient(err) ? "transient" : "error",
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `fn` against the configured models. For each model, retry up to
 * ATTEMPTS_PER_MODEL times on transient (429/503/timeout) or bad-response
 * (GenerationSkipError) errors with exponential backoff + jitter, keeping the
 * strongest model in play before falling back to a weaker one. Non-retryable
 * errors propagate immediately.
 *
 * `fn` receives the model name AND the current attempt number (for log
 * correlation) so callers can thread it into callGemini.
 */
export async function generateWithRetry<T>(
  fn: (model: string, attempt: number) => Promise<T>,
): Promise<T> {
  const models = getModels();
  for (const model of models) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await fn(model, attempt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        const transient = isTransient(err);
        const skip = err instanceof GenerationSkipError;
        if (!transient && !skip) {
          console.error(`[gemini] ${model} failed (non-retryable): ${msg}`);
          throw err;
        }
        const reason = transient ? "api error" : "bad response";
        if (attempt < ATTEMPTS_PER_MODEL) {
          const wait = backoffMs(attempt);
          console.warn(`[gemini] ${model} attempt ${attempt} (${reason}): ${msg} — retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        console.warn(`[gemini] ${model} exhausted after ${attempt} attempts (${reason}): ${msg} — trying next model`);
      }
    }
  }
  console.error("[gemini] all models exhausted");
  throw new Error(
    "Plan generation is temporarily unavailable. Please try again in a few minutes.",
  );
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

export function parseGeminiJson(text: string): unknown {
  const raw = stripJsonFences(text);
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(jsonrepair(raw));
  }
}

export function getGeminiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const nestedMessage = readNestedString(error, ["error", "message"]);
  if (nestedMessage) {
    return nestedMessage;
  }

  return "Gemini request failed";
}

function readNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}
