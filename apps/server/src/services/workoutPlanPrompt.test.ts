import { describe, expect, it } from "vitest";
import type { Profile } from "@platform/db";
import { buildSystemPrompt, buildUserPrompt } from "./workoutPlanPrompt.js";
import { exerciseSchema } from "./workoutPlanSchema.js";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    userId: "u1",
    unitSystem: "imperial",
    age: 30,
    sex: "male",
    weightLbs: 180,
    heightIn: 70,
    experienceLevel: "intermediate",
    trainingDaysPerWeek: 4,
    trainingDays: ["Mon", "Wed", "Fri", "Sat"],
    goal: "build_muscle",
    caloricTarget: 2400,
    proteinTargetG: 170,
    dietaryNotes: null,
    mealComplexity: "varied",
    leftoverPreference: "occasional",
    varietyStrength: "medium",
    cuisineLikes: [],
    cuisineDislikes: [],
    weeknightMaxMinutes: null,
    weekendRelaxed: true,
    workoutStyle: "ppl",
    workoutDuration: 60,
    workoutTypes: ["lifts", "core"],
    workoutVariety: "medium",
    equipment: ["barbell", "dumbbells"],
    hydrationGoal: 8,
    updatedAt: new Date(),
    ...overrides,
  } as Profile;
}

function prompt(overrides: Partial<Profile> = {}, extra: Partial<Parameters<typeof buildUserPrompt>[0]> = {}) {
  return buildUserPrompt({
    profile: profile(overrides),
    recentProgress: [],
    previousPlan: null,
    baselines: [],
    ...extra,
  });
}

describe("buildUserPrompt session length", () => {
  it("targets the configured duration with a matching exercise-count guide", () => {
    const out = prompt({ workoutDuration: 30 });
    expect(out).toContain("~30 minutes");
    expect(out).toContain("3-4 exercises");
  });

  it("scales the guide up for long sessions", () => {
    const out = prompt({ workoutDuration: 90 });
    expect(out).toContain("~90 minutes");
    expect(out).toContain("9-11 exercises");
  });

  it("defaults to 60 minutes on a legacy profile without the field", () => {
    const out = prompt({ workoutDuration: undefined as never });
    expect(out).toContain("~60 minutes");
    expect(out).toContain("6-8 exercises");
  });
});

describe("buildUserPrompt workout types", () => {
  it("includes core and excludes cardio by default", () => {
    const out = prompt();
    expect(out).toContain("End every training day with 1-2 core / ab exercises");
    expect(out).toContain("Do NOT include any cardio");
  });

  it("drops core work for lifts-only", () => {
    const out = prompt({ workoutTypes: ["lifts"] });
    expect(out).toContain("Do NOT program dedicated core / ab exercises");
    expect(out).toContain("Do NOT include any cardio");
  });

  it("adds a cardio finisher rule when cardio is enabled", () => {
    const out = prompt({ workoutTypes: ["lifts", "core", "cardio"], workoutDuration: 60 });
    expect(out).toContain("cardio finisher");
    expect(out).toContain("10-15 minutes");
    expect(out).toContain("End every training day with 1-2 core / ab exercises");
  });

  it("falls back to lifts+core on a legacy profile without the field", () => {
    const out = prompt({ workoutTypes: undefined as never });
    expect(out).toContain("End every training day with 1-2 core / ab exercises");
    expect(out).toContain("Do NOT include any cardio");
  });
});

describe("buildUserPrompt variety", () => {
  it("omits the variety block without recent names", () => {
    const out = prompt();
    expect(out).not.toContain("RECENTLY PRESCRIBED");
  });

  it("lists recent exercises with soft wording by default", () => {
    const out = prompt({}, { recentExerciseNames: ["Bench Press", "Lat Pulldown"] });
    expect(out).toContain("RECENTLY PRESCRIBED");
    expect(out).toContain("Bench Press; Lat Pulldown");
    expect(out).toContain("swap a few accessory movements");
  });

  it("rotates aggressively with strict tone and reframes the previous plan", () => {
    const out = buildUserPrompt({
      profile: profile(),
      recentProgress: [],
      previousPlan: {
        id: "w1",
        userId: "u1",
        weekStartDate: new Date(),
        planJson: { summary: "s", progressionNotes: "p", days: [] },
        isActive: true,
        createdAt: new Date(),
      } as never,
      baselines: [],
      recentExerciseNames: ["Cable Fly"],
      varietyTone: "strict",
    });
    expect(out).toContain("Rotate aggressively");
    expect(out).toContain("structure/progression reference only");
    expect(out).not.toContain("keep movement selection coherent");
  });
});

describe("buildSystemPrompt exercise types", () => {
  it("documents the type and durationMinutes fields", () => {
    const out = buildSystemPrompt();
    expect(out).toContain("type: 'strength'|'cardio'|'core'");
    expect(out).toContain("durationMinutes");
    expect(out).toContain("For type:'cardio' entries");
  });

  it("no longer hard-codes the core rule", () => {
    expect(buildSystemPrompt()).not.toContain("Include 1-2 core / ab exercises");
  });
});

describe("exerciseSchema back-compat", () => {
  const legacy = {
    name: "Bench Press",
    muscleGroup: "Chest",
    description: "Press the bar.",
    sets: 3,
    reps: "8-10",
    loadLbs: 135,
    restSeconds: 90,
  };

  it("parses a pre-types exercise as strength", () => {
    const parsed = exerciseSchema.parse(legacy);
    expect(parsed.type).toBe("strength");
    expect(parsed.durationMinutes ?? null).toBeNull();
  });

  it("keeps durationMinutes on cardio entries", () => {
    const parsed = exerciseSchema.parse({
      ...legacy,
      name: "Bike Intervals",
      type: "cardio",
      durationMinutes: 15,
      loadLbs: null,
      restSeconds: 0,
      sets: 1,
      reps: "—",
    });
    expect(parsed.type).toBe("cardio");
    expect(parsed.durationMinutes).toBe(15);
  });

  it("coerces an invalid type to strength", () => {
    const parsed = exerciseSchema.parse({ ...legacy, type: "mobility" });
    expect(parsed.type).toBe("strength");
  });
});
