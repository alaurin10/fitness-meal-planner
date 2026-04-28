import type { QuantityJson } from "./mealPlanSchema.js";

/**
 * Canonical units the app understands. Anything else is treated as a free-form unit.
 */
export const UNIT_DIMENSIONS: Record<string, "mass" | "volume" | "count" | "free"> = {
  g: "mass",
  kg: "mass",
  oz: "mass",
  lb: "mass",
  ml: "volume",
  L: "volume",
  tsp: "volume",
  tbsp: "volume",
  cup: "volume",
  "fl oz": "volume",
  piece: "count",
  slice: "count",
  clove: "count",
  can: "count",
  pinch: "free",
  "to taste": "free",
  "": "free",
};

const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  L: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  "fl oz": 29.5735,
};

/**
 * Size adjectives that sometimes appear before a unit word.
 * We strip them so "large piece" → "piece", enabling numeric merging.
 */
const SIZE_ADJECTIVES = /^(large|small|medium|big|thin|thick|extra[- ]?large|extra[- ]?small|whole|half)\s+/i;

export function normalizeUnit(unit: string | undefined | null): string {
  if (!unit) return "";
  let u = unit.trim();
  if (u in UNIT_DIMENSIONS) return u;
  // Strip size adjectives so "large piece" → "piece"
  u = u.replace(SIZE_ADJECTIVES, "");
  if (u in UNIT_DIMENSIONS) return u;
  // case-insensitive lookup with some common aliases
  const lower = u.toLowerCase();
  const aliases: Record<string, string> = {
    grams: "g",
    gram: "g",
    kilogram: "kg",
    kilograms: "kg",
    ounce: "oz",
    ounces: "oz",
    pound: "lb",
    pounds: "lb",
    lbs: "lb",
    milliliter: "ml",
    milliliters: "ml",
    liter: "L",
    liters: "L",
    l: "L",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cups: "cup",
    "fluid ounce": "fl oz",
    "fluid ounces": "fl oz",
    floz: "fl oz",
    pieces: "piece",
    pc: "piece",
    pcs: "piece",
    slices: "slice",
    cloves: "clove",
    cans: "can",
    pinches: "pinch",
  };
  if (lower in aliases) return aliases[lower]!;
  if (lower in UNIT_DIMENSIONS) return lower;
  return u; // unknown unit; keep as-is
}

export function unitDimension(unit: string): "mass" | "volume" | "count" | "free" {
  return UNIT_DIMENSIONS[normalizeUnit(unit)] ?? "free";
}

/**
 * Try to parse a free-form quantity string ("2 cups", "200 g", "1/2 tbsp", "to taste")
 * into a structured Quantity. Falls back to { amount:0, unit:"", display: input }.
 */
export function parseQuantityString(raw: string | undefined | null): QuantityJson {
  if (!raw) return { amount: 0, unit: "" };
  const trimmed = String(raw).trim();
  if (!trimmed) return { amount: 0, unit: "" };
  if (/^to taste$/i.test(trimmed)) return { amount: 0, unit: "to taste" };
  if (/^pinch( of)?/i.test(trimmed)) return { amount: 1, unit: "pinch" };

  // Match "<amount> <unit>" where amount may be "1", "1.5", "1/2", "1 1/2"
  const m = trimmed.match(
    /^(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*([a-zA-Z][a-zA-Z\s]*)?$/,
  );
  if (m) {
    const amount = parseAmount(m[1]!);
    const unit = normalizeUnit(m[2]?.trim() ?? "");
    if (Number.isFinite(amount)) return { amount, unit };
  }
  return { amount: 0, unit: "", display: trimmed };
}

function parseAmount(s: string): number {
  const t = s.trim();
  if (t.includes("/")) {
    const parts = t.split(/\s+/);
    if (parts.length === 2) {
      // mixed e.g. "1 1/2"
      const whole = Number(parts[0]);
      const frac = parseFraction(parts[1]!);
      return whole + frac;
    }
    return parseFraction(t);
  }
  return Number(t);
}

function parseFraction(s: string): number {
  const [n, d] = s.split("/").map(Number);
  if (!n || !d) return NaN;
  return n / d;
}

/**
 * Sum two quantities in compatible units; returns null if they can't be combined.
 */
export function addQuantities(
  a: QuantityJson,
  b: QuantityJson,
): QuantityJson | null {
  const ua = normalizeUnit(a.unit);
  const ub = normalizeUnit(b.unit);
  if (ua === ub) {
    return { amount: round2(a.amount + b.amount), unit: ua };
  }
  const dimA = unitDimension(ua);
  const dimB = unitDimension(ub);
  if (dimA !== dimB || dimA === "free") return null;

  if (dimA === "mass") {
    const grams = a.amount * MASS_TO_G[ua]! + b.amount * MASS_TO_G[ub]!;
    // Pick the larger of the two as the target unit (so kg + g stays in kg)
    const targetUnit = MASS_TO_G[ua]! >= MASS_TO_G[ub]! ? ua : ub;
    return { amount: round2(grams / MASS_TO_G[targetUnit]!), unit: targetUnit };
  }
  if (dimA === "volume") {
    const ml = a.amount * VOLUME_TO_ML[ua]! + b.amount * VOLUME_TO_ML[ub]!;
    const targetUnit = VOLUME_TO_ML[ua]! >= VOLUME_TO_ML[ub]! ? ua : ub;
    return { amount: round2(ml / VOLUME_TO_ML[targetUnit]!), unit: targetUnit };
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Render a quantity as a display string (for the canonical/source unit).
 * UI layer can convert to user's preferred unit system before display.
 */
export function quantityDisplay(q: QuantityJson): string {
  if (q.display) return q.display;
  if (q.unit === "to taste") return "to taste";
  if (q.amount === 0 && !q.unit) return "";
  if (q.unit === "" || q.unit === "piece") {
    return `${formatAmount(q.amount)}${q.unit ? ` ${q.unit}` : ""}`.trim();
  }
  return `${formatAmount(q.amount)} ${q.unit}`.trim();
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return String(round2(n));
}
