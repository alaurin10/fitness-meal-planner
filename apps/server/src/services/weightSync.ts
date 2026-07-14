import { prisma } from "@platform/db";
import { computeTargets } from "./targets.js";

/**
 * Sync a newly logged body weight back to the profile so calorie/protein
 * targets stay accurate. If the user's stored targets currently match the
 * suggested values for their OLD weight, they're on "suggested" mode —
 * recompute targets at the new weight. Otherwise they've explicitly
 * overridden the targets, so preserve them.
 *
 * Shared by manual progress logging and Garmin weight sync.
 * Returns the updated profile, or null when the user has no profile yet.
 */
export async function applyWeightToProfile(userId: string, weightLbs: number) {
  const current = await prisma.profile.findUnique({ where: { userId } });
  if (!current) return null;

  const oldSuggested = computeTargets({
    sex: current.sex,
    age: current.age,
    weightLbs: current.weightLbs,
    heightIn: current.heightIn,
    trainingDaysPerWeek: current.trainingDaysPerWeek,
    goal: current.goal,
  });
  const newSuggested = computeTargets({
    sex: current.sex,
    age: current.age,
    weightLbs,
    heightIn: current.heightIn,
    trainingDaysPerWeek: current.trainingDaysPerWeek,
    goal: current.goal,
  });

  const onSuggestedCalories =
    oldSuggested != null && current.caloricTarget === oldSuggested.caloricTarget;
  const onSuggestedProtein =
    oldSuggested != null && current.proteinTargetG === oldSuggested.proteinTargetG;

  return prisma.profile.update({
    where: { userId },
    data: {
      weightLbs,
      caloricTarget:
        onSuggestedCalories && newSuggested
          ? newSuggested.caloricTarget
          : current.caloricTarget,
      proteinTargetG:
        onSuggestedProtein && newSuggested
          ? newSuggested.proteinTargetG
          : current.proteinTargetG,
    },
  });
}
