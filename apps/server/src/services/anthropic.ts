import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
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

export function getAnthropicErrorMessage(error: unknown): string {
  const nestedMessage = readNestedString(error, ["error", "message"]);
  if (nestedMessage) {
    return nestedMessage;
  }

  if (error instanceof Error && error.message) {
    const parsed = tryParseAnthropicMessage(error.message);
    return parsed ?? error.message;
  }

  return "Anthropic request failed";
}

function tryParseAnthropicMessage(message: string): string | null {
  const jsonStart = message.indexOf("{");
  if (jsonStart === -1) return null;

  try {
    const parsed = JSON.parse(message.slice(jsonStart)) as {
      error?: { message?: string };
    };
    return parsed.error?.message ?? null;
  } catch {
    return null;
  }
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
