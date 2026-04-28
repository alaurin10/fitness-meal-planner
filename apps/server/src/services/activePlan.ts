import { prisma } from "@platform/db";

/**
 * Find the active workout plan for a user at a given point in time.
 * Resolves by weekStartDate <= now, most recent weekStartDate, then most recent createdAt.
 */
export async function findActiveWorkoutPlan(userId: string, now = new Date()) {
  return prisma.weeklyPlan.findFirst({
    where: { userId, weekStartDate: { lte: now } },
    orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Find the active meal plan for a user at a given point in time.
 */
export async function findActiveMealPlan(userId: string, now = new Date()) {
  return prisma.weeklyMealPlan.findFirst({
    where: { userId, weekStartDate: { lte: now } },
    orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Find the workout plan for an exact week. When multiple plans exist for the
 * same weekStartDate (deactivated + replacement), returns the newest.
 */
export async function findWorkoutPlanForWeek(userId: string, weekStartDate: Date) {
  return prisma.weeklyPlan.findFirst({
    where: { userId, weekStartDate },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find the meal plan for an exact week.
 */
export async function findMealPlanForWeek(userId: string, weekStartDate: Date) {
  return prisma.weeklyMealPlan.findFirst({
    where: { userId, weekStartDate },
    orderBy: { createdAt: "desc" },
  });
}
