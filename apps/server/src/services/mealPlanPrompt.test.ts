import { describe, expect, it } from "vitest";
import type { Profile } from "@platform/db";
import { buildSingleMealUserPrompt, buildUserPrompt } from "./mealPlanPrompt.js";
import type { TrainingSchedule } from "./schedule.js";

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
    equipment: [],
    hydrationGoal: 8,
    updatedAt: new Date(),
    ...overrides,
  } as Profile;
}

const schedule: TrainingSchedule = {
  trainingDays: ["Mon", "Wed"],
  avgDailyCaloriesBurned: 150,
  goal: "build_muscle",
};

describe("buildUserPrompt leftover guidance", () => {
  it("forbids leftovers for preference=none", () => {
    const out = buildUserPrompt({ profile: profile({ leftoverPreference: "none" }), schedule });
    expect(out).toContain("Do not plan any leftover meals");
    expect(out).not.toContain("EVERY lunch in this plan MUST be leftovers");
  });

  it("mandates leftover lunches for preference=often", () => {
    const out = buildUserPrompt({ profile: profile({ leftoverPreference: "often" }), schedule });
    expect(out).toContain("EVERY lunch in this plan MUST be leftovers");
    expect(out).toContain("leftoverOf");
  });

  it("defaults to occasional wording", () => {
    const out = buildUserPrompt({ profile: profile({ leftoverPreference: "bogus" as never }), schedule });
    expect(out).toContain("1-3 leftover lunches");
  });

  it("keeps complexity guidance leftover-free", () => {
    const out = buildUserPrompt({
      profile: profile({ mealComplexity: "simple", leftoverPreference: "none" }),
      schedule,
    });
    expect(out).toContain("simple and quick to prepare");
    expect(out).toContain("Do not plan any leftover meals");
  });
});

describe("buildUserPrompt cuisine + time budget", () => {
  it("renders likes and dislikes when set", () => {
    const out = buildUserPrompt({
      profile: profile({ cuisineLikes: ["thai", "mexican"], cuisineDislikes: ["mushrooms"] }),
      schedule,
    });
    expect(out).toContain("CUISINE PREFERENCES");
    expect(out).toContain("thai, mexican");
    expect(out).toContain("NEVER use");
    expect(out).toContain("mushrooms");
  });

  it("omits the cuisine block when both lists are empty", () => {
    const out = buildUserPrompt({ profile: profile(), schedule });
    expect(out).not.toContain("CUISINE PREFERENCES");
  });

  it("renders the weeknight time budget with weekend wording", () => {
    const relaxed = buildUserPrompt({
      profile: profile({ weeknightMaxMinutes: 35 }),
      schedule,
    });
    expect(relaxed).toContain("TIME BUDGET");
    expect(relaxed).toContain("35 minutes");
    expect(relaxed).toContain("Weekend meals may be more involved");

    const strict = buildUserPrompt({
      profile: profile({ weeknightMaxMinutes: 35, weekendRelaxed: false }),
      schedule,
    });
    expect(strict).toContain("Apply the same limit on weekends");
  });
});

describe("buildUserPrompt variety block", () => {
  it("lists recent meal names with strict tone extras", () => {
    const out = buildUserPrompt({
      profile: profile(),
      schedule,
      recentMealNames: ["Chicken tikka", "Beef ragu"],
      varietyTone: "strict",
    });
    expect(out).toContain("RECENTLY SERVED");
    expect(out).toContain("Chicken tikka; Beef ragu");
    expect(out).toContain("no two dinners share a primary protein");
  });

  it("omits the block without names", () => {
    const out = buildUserPrompt({ profile: profile(), schedule });
    expect(out).not.toContain("RECENTLY SERVED");
  });
});

describe("buildUserPrompt snack days", () => {
  it("instructs a slot:'snack' meal on the requested days", () => {
    const out = buildUserPrompt({
      profile: profile(),
      schedule,
      snackDays: ["Mon", "Thu"],
    });
    expect(out).toContain("slot:'snack'");
    expect(out).toContain("Mon, Thu");
  });

  it("omits the snack instruction when no snack days are requested", () => {
    const out = buildUserPrompt({ profile: profile(), schedule });
    expect(out).not.toContain("the user WANTS a snack");
  });
});

describe("buildSingleMealUserPrompt", () => {
  it("keeps strict wording for the replaced meal and lists week avoids", () => {
    const out = buildSingleMealUserPrompt({
      profile: profile(),
      slot: "dinner",
      avoidNames: ["Old dinner", "Other meal A", "Other meal B"],
    });
    expect(out).toContain('Do NOT generate a recipe named "Old dinner"');
    expect(out).toContain('"Other meal A"; "Other meal B"');
  });

  it("includes cuisine preferences from the profile", () => {
    const out = buildSingleMealUserPrompt({
      profile: profile({ cuisineDislikes: ["olives"] }),
      slot: "lunch",
    });
    expect(out).toContain("olives");
  });
});
