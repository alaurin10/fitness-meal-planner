import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";

export const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemma-4-31b-it",
];

export class GenerationSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationSkipError";
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

export async function generateWithRetry<T>(
  fn: (model: string) => Promise<T>,
): Promise<T> {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
  for (const model of models) {
    try {
      return await fn(model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      if (isQuotaExhausted(err) || isUnavailable(err)) {
        console.warn(`[gemini] ${model} skipped (api error): ${msg}`);
        continue;
      }
      if (err instanceof GenerationSkipError) {
        console.warn(`[gemini] ${model} skipped (bad response): ${msg}`);
        continue;
      }
      console.error(`[gemini] ${model} failed (non-retryable): ${msg}`);
      throw err;
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
