export type UnitSystem = "imperial" | "metric";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const G_PER_OZ = 28.3495;
const ML_PER_FLOZ = 29.5735;

export function poundsToKg(value: number) {
  return value * KG_PER_LB;
}

export function kgToPounds(value: number) {
  return value / KG_PER_LB;
}

export function inchesToCm(value: number) {
  return value * CM_PER_IN;
}

export function cmToInches(value: number) {
  return value / CM_PER_IN;
}

export function formatWeight(valueLbs: number, unitSystem: UnitSystem, decimals = 1) {
  const value = unitSystem === "metric" ? poundsToKg(valueLbs) : valueLbs;
  return roundTo(value, decimals);
}

export function formatLoad(valueLbs: number, unitSystem: UnitSystem) {
  const value = unitSystem === "metric" ? poundsToKg(valueLbs) : valueLbs;
  return roundTo(value, unitSystem === "metric" ? 1 : 0);
}

export function weightUnitLabel(unitSystem: UnitSystem) {
  return unitSystem === "metric" ? "kg" : "lb";
}

export function heightUnitLabel(unitSystem: UnitSystem) {
  return unitSystem === "metric" ? "cm" : "in";
}

export function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// ---------- Cooking quantity formatting ----------

export interface Quantity {
  amount: number;
  unit: string;
  display?: string;
}

const FREE_UNITS = new Set(["", "to taste", "pinch", "piece", "slice", "clove", "can"]);

/**
 * Format a structured cooking quantity for display, optionally converting
 * between metric and imperial cooking units. Volume measures (cup/tsp/tbsp)
 * are kept as-is since they're standard in both systems.
 */
export function formatQuantity(
  q: Quantity | undefined | null,
  unitSystem: UnitSystem,
  servingsScale = 1,
): string {
  if (!q) return "";
  if (q.display && servingsScale === 1) return q.display;
  if (FREE_UNITS.has(q.unit)) {
    if (q.unit === "to taste") return "to taste";
    const scaled = q.amount * servingsScale;
    if (q.amount === 0 && !q.unit) return "";
    return `${formatAmount(scaled)}${q.unit ? ` ${q.unit}` : ""}`.trim();
  }

  const scaled = q.amount * servingsScale;
  let { amount, unit } = convertCookingUnit(scaled, q.unit, unitSystem);
  amount = friendlyRound(amount, unit);
  return `${formatAmount(amount)} ${unit}`.trim();
}

function convertCookingUnit(
  amount: number,
  unit: string,
  system: UnitSystem,
): { amount: number; unit: string } {
  if (system === "imperial") {
    if (unit === "g") {
      if (amount >= 454) return { amount: amount / 453.592, unit: "lb" };
      return { amount: amount / G_PER_OZ, unit: "oz" };
    }
    if (unit === "kg") return { amount: amount * 1000 / 453.592, unit: "lb" };
    if (unit === "ml") {
      if (amount >= 240) return { amount: amount / 236.588, unit: "cup" };
      return { amount: amount / ML_PER_FLOZ, unit: "fl oz" };
    }
    if (unit === "L") return { amount: amount * 1000 / 236.588, unit: "cup" };
  } else {
    if (unit === "oz") return { amount: amount * G_PER_OZ, unit: "g" };
    if (unit === "lb") {
      const g = amount * 453.592;
      if (g >= 1000) return { amount: g / 1000, unit: "kg" };
      return { amount: g, unit: "g" };
    }
    if (unit === "fl oz") return { amount: amount * ML_PER_FLOZ, unit: "ml" };
  }
  return { amount, unit };
}

function friendlyRound(amount: number, unit: string): number {
  if (unit === "g" || unit === "ml") return Math.round(amount);
  if (unit === "kg" || unit === "L" || unit === "lb") return roundTo(amount, 2);
  if (unit === "oz" || unit === "fl oz" || unit === "cup") return roundTo(amount, 2);
  return roundTo(amount, 2);
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  // Convert common decimals to fractions for cooking readability
  const fractions: Array<[number, string]> = [
    [0.125, "1/8"],
    [0.25, "1/4"],
    [0.333, "1/3"],
    [0.5, "1/2"],
    [0.667, "2/3"],
    [0.75, "3/4"],
  ];
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [val, label] of fractions) {
    if (Math.abs(frac - val) < 0.02) {
      return whole === 0 ? label : `${whole} ${label}`;
    }
  }
  return String(roundTo(n, 2));
}

export function formatMinutes(min: number | undefined): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
