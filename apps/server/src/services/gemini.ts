import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";

export const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = ["gemini-2.0-flash"];

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function isRetryable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  return msg.includes("503") || msg.toLowerCase().includes("unavailable");
}

function isModelUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  return msg.includes("404") || msg.toLowerCase().includes("not_found") || msg.toLowerCase().includes("not found");
}

function isQuotaExhausted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  return msg.includes("429") || msg.toLowerCase().includes("resource_exhausted") || msg.toLowerCase().includes("quota");
}

export async function generateWithRetry(
  fn: (model: string) => Promise<string>,
): Promise<string> {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        const isLast = model === models[models.length - 1] && attempt === 2;
        if (isQuotaExhausted(err) || isModelUnavailable(err)) {
          // Quota exhausted or model removed — move to next model
          break;
        }
        if (isLast) throw err;
        if (!isRetryable(err)) throw err;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
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
