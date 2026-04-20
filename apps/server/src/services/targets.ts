export interface TargetInputs {
  sex: string | null;
  age: number | null;
  weightLbs: number | null;
  heightIn: number | null;
  trainingDaysPerWeek: number;
  goal: string;
}

export interface ComputedTargets {
  caloricTarget: number;
  proteinTargetG: number;
}

const ACTIVITY_BY_DAYS = [1.2, 1.375, 1.375, 1.465, 1.55, 1.725, 1.9];

export function computeTargets(p: TargetInputs): ComputedTargets {
  const kg = (p.weightLbs ?? 0) * 0.4536;
  const cm = (p.heightIn ?? 0) * 2.54;
  const age = p.age ?? 30;
  const sexOffset = p.sex === "female" ? -161 : 5;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + sexOffset;

  const daysIdx = Math.max(0, Math.min(6, p.trainingDaysPerWeek));
  const activity = ACTIVITY_BY_DAYS[daysIdx] ?? 1.375;

  const goalAdj = p.goal === "lose_fat" ? -400 : p.goal === "build_muscle" ? 250 : 0;
  const caloricTarget = Math.max(1200, Math.round(bmr * activity + goalAdj));

  const pPerKg = p.goal === "build_muscle" ? 2.0 : p.goal === "lose_fat" ? 2.2 : 1.6;
  const proteinTargetG = Math.max(40, Math.round(kg * pPerKg));

  return { caloricTarget, proteinTargetG };
}
