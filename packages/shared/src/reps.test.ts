import { describe, expect, it } from "vitest";
import { parseRepDuration } from "./reps.js";

describe("parseRepDuration — seconds", () => {
  it.each([
    ["30s", 30],
    ["30 s", 30],
    ["30sec", 30],
    ["30 secs", 30],
    ["45 seconds", 45],
    ["45 second", 45],
  ])("%s → %is", (input, seconds) => {
    expect(parseRepDuration(input)).toEqual({ seconds, perSide: false });
  });

  it("finds the duration among surrounding words", () => {
    expect(parseRepDuration("hold 30s")).toEqual({ seconds: 30, perSide: false });
    expect(parseRepDuration("30 sec hold")).toEqual({ seconds: 30, perSide: false });
  });
});

describe("parseRepDuration — clock format", () => {
  it("parses M:SS anywhere in the string", () => {
    expect(parseRepDuration("1:30")).toEqual({ seconds: 90, perSide: false });
    expect(parseRepDuration("0:30 hold")).toEqual({ seconds: 30, perSide: false });
  });
});

describe("parseRepDuration — minutes", () => {
  it.each([
    ["1 min", 60],
    ["1 minute", 60],
    ["2 mins", 120],
    ["1.5 min", 90],
  ])("%s → %is", (input, seconds) => {
    expect(parseRepDuration(input)).toEqual({ seconds, perSide: false });
  });
});

describe("parseRepDuration — ranges use the upper bound", () => {
  it.each([
    ["30-45 sec", 45],
    ["30–45s", 45], // en dash
    ["20 to 30 seconds", 30],
  ])("%s → %is", (input, seconds) => {
    expect(parseRepDuration(input)).toEqual({ seconds, perSide: false });
  });
});

describe("parseRepDuration — per side", () => {
  it.each([
    ["60 seconds per side", 60],
    ["45s each side", 45],
    ["30s/side", 30],
  ])("%s → %is per side", (input, seconds) => {
    expect(parseRepDuration(input)).toEqual({ seconds, perSide: true });
  });
});

describe("parseRepDuration — rep strings stay rep strings", () => {
  it.each([["8-10"], ["5"], ["12"], ["AMRAP"], ["max"], ["12 reps"], ["8-12 reps"], ["10 steps"], ["—"], [""]])(
    "%s → null",
    (input) => {
      expect(parseRepDuration(input)).toBeNull();
    },
  );

  it("treats a bare large 'm' as distance, not minutes", () => {
    expect(parseRepDuration("500m row")).toBeNull();
  });

  it("still accepts a small bare 'm' as minutes", () => {
    expect(parseRepDuration("2m plank")).toEqual({ seconds: 120, perSide: false });
  });

  it("rejects zero and absurd durations", () => {
    expect(parseRepDuration("0:00")).toBeNull();
    expect(parseRepDuration("0s")).toBeNull();
    expect(parseRepDuration("120 min")).toBeNull();
  });
});
