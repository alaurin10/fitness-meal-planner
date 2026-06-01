import { prisma } from "@platform/db";
import { startOfWeek, type WeekStartDay } from "@platform/shared";

/**
 * Find the most-recent workout plan for a user with weekStartDate <= now.
 *
 * NOTE: This can return a plan from a previous week if the user hasn't
 * generated one for the current week. For user-facing reads tied to "this
 * week", prefer `findCurrentWeekWorkoutPlan`. This finder is still useful
 * for cross-week contexts (AI seeding, history/stats).
 */
export async function findActiveWorkoutPlan(userId: string, now = new Date()) {
  return prisma.weeklyPlan.findFirst({
    where: { userId, weekStartDate: { lte: now } },
    orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Find the most-recent meal plan for a user with weekStartDate <= now.
 * Same caveat as `findActiveWorkoutPlan`.
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

/**
 * Find the workout plan for the user's *current* week, derived from their
 * configured weekStartDay. Returns null if no plan exists for this week —
 * even if a stale plan from a prior week is present.
 */
export async function findCurrentWeekWorkoutPlan(
  userId: string,
  weekStartDay: WeekStartDay,
  now = new Date(),
) {
  return findWorkoutPlanForWeek(userId, startOfWeek(now, weekStartDay));
}

/**
 * Find the meal plan for the user's *current* week.
 */
export async function findCurrentWeekMealPlan(
  userId: string,
  weekStartDay: WeekStartDay,
  now = new Date(),
) {
  return findMealPlanForWeek(userId, startOfWeek(now, weekStartDay));
}
