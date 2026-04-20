export interface TargetInputs {
  sex: "male" | "female" | null;
  age: number | null;
  weightLbs: number | null;
  heightIn: number | null;
  trainingDaysPerWeek: number;
  goal: "build_muscle" | "lose_fat" | "maintain";
}

export interface SuggestedTargets {
  caloricTarget: number;
  proteinTargetG: number;
}

const ACTIVITY_BY_DAYS = [1.2, 1.375, 1.465, 1.55, 1.65, 1.725, 1.9];

export function computeSuggestedTargets(p: TargetInputs): SuggestedTargets | null {
  if (p.sex == null || p.age == null || p.weightLbs == null || p.heightIn == null) {
    return null;
  }

  const kg = p.weightLbs * 0.4536;
  const cm = p.heightIn * 2.54;
  const sexOffset = p.sex === "female" ? -161 : 5;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + sexOffset;
  const daysIdx = Math.max(0, Math.min(ACTIVITY_BY_DAYS.length - 1, p.trainingDaysPerWeek - 1));
  const activity = ACTIVITY_BY_DAYS[daysIdx] ?? 1.375;
  const goalAdj = p.goal === "lose_fat" ? -400 : p.goal === "build_muscle" ? 250 : 0;
  const caloricTarget = Math.max(1200, Math.round(bmr * activity + goalAdj));
  const pPerKg = p.goal === "build_muscle" ? 2.0 : p.goal === "lose_fat" ? 2.2 : 1.6;
  const proteinTargetG = Math.max(40, Math.round(kg * pPerKg));

  return { caloricTarget, proteinTargetG };
}
