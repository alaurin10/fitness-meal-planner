import { describe, expect, it } from "vitest";
import {
  addQuantities,
  formatAmount,
  normalizeUnit,
  parseQuantityString,
  unitDimension,
} from "./quantity.js";

describe("normalizeUnit", () => {
  it("passes canonical units through", () => {
    expect(normalizeUnit("g")).toBe("g");
    expect(normalizeUnit("tbsp")).toBe("tbsp");
  });
  it("resolves aliases", () => {
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("lbs")).toBe("lb");
    expect(normalizeUnit("tablespoons")).toBe("tbsp");
    expect(normalizeUnit("pcs")).toBe("piece");
  });
  it("strips size adjectives", () => {
    expect(normalizeUnit("large piece")).toBe("piece");
    expect(normalizeUnit("extra-large clove")).toBe("clove");
  });
  it("keeps unknown units as-is", () => {
    expect(normalizeUnit("sprig")).toBe("sprig");
  });
  it("treats empty/nullish as free unit", () => {
    expect(normalizeUnit("")).toBe("");
    expect(normalizeUnit(null)).toBe("");
    expect(normalizeUnit(undefined)).toBe("");
  });
});

describe("unitDimension", () => {
  it("classifies units", () => {
    expect(unitDimension("kg")).toBe("mass");
    expect(unitDimension("cup")).toBe("volume");
    expect(unitDimension("piece")).toBe("count");
    expect(unitDimension("to taste")).toBe("free");
    expect(unitDimension("sprig")).toBe("free");
  });
});

describe("parseQuantityString", () => {
  it("parses amount + unit", () => {
    expect(parseQuantityString("200 g")).toEqual({ amount: 200, unit: "g" });
    expect(parseQuantityString("2 cups")).toEqual({ amount: 2, unit: "cup" });
  });
  it("parses fractions and mixed numbers", () => {
    expect(parseQuantityString("1/2 tbsp")).toEqual({ amount: 0.5, unit: "tbsp" });
    expect(parseQuantityString("1 1/2 cup")).toEqual({ amount: 1.5, unit: "cup" });
  });
  it("handles to taste and pinch", () => {
    expect(parseQuantityString("to taste")).toEqual({ amount: 0, unit: "to taste" });
    expect(parseQuantityString("pinch of salt")).toEqual({ amount: 1, unit: "pinch" });
  });
  it("falls back to display for unparseable input", () => {
    expect(parseQuantityString("a handful")).toEqual({ amount: 0, unit: "", display: "a handful" });
  });
  it("returns empty quantity for blank input", () => {
    expect(parseQuantityString("")).toEqual({ amount: 0, unit: "" });
    expect(parseQuantityString(null)).toEqual({ amount: 0, unit: "" });
  });
});

describe("addQuantities", () => {
  it("sums identical units", () => {
    expect(addQuantities({ amount: 2, unit: "cup" }, { amount: 1, unit: "cup" })).toEqual({
      amount: 3,
      unit: "cup",
    });
  });
  it("converts within the mass dimension, keeping the larger unit", () => {
    // 1 kg + 500 g = 1.5 kg
    expect(addQuantities({ amount: 1, unit: "kg" }, { amount: 500, unit: "g" })).toEqual({
      amount: 1.5,
      unit: "kg",
    });
  });
  it("converts within the volume dimension", () => {
    // 1 L + 500 ml = 1.5 L
    expect(addQuantities({ amount: 1, unit: "L" }, { amount: 500, unit: "ml" })).toEqual({
      amount: 1.5,
      unit: "L",
    });
  });
  it("returns null for incompatible dimensions", () => {
    expect(addQuantities({ amount: 1, unit: "g" }, { amount: 1, unit: "cup" })).toBeNull();
  });
  it("returns null for free-dimension units", () => {
    expect(addQuantities({ amount: 1, unit: "piece" }, { amount: 1, unit: "slice" })).toBeNull();
  });
  it("absorbs 'to taste' into the quantitative side", () => {
    expect(addQuantities({ amount: 0, unit: "to taste" }, { amount: 2, unit: "tsp" })).toEqual({
      amount: 2,
      unit: "tsp",
    });
    expect(addQuantities({ amount: 0, unit: "to taste" }, { amount: 0, unit: "to taste" })).toEqual({
      amount: 0,
      unit: "to taste",
    });
  });
});

describe("formatAmount", () => {
  it("formats integers and rounded decimals", () => {
    expect(formatAmount(3)).toBe("3");
    expect(formatAmount(1.5)).toBe("1.5");
    expect(formatAmount(1.005)).toBe("1");
  });
});
