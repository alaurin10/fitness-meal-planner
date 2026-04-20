export type UnitSystem = "imperial" | "metric";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

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
