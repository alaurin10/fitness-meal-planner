-- Detach MealCompletion.planId from WeeklyMealPlan so completion history
-- survives when a past plan is deleted to save storage. planId is kept as
-- a denormalized string column.
ALTER TABLE "MealCompletion" DROP CONSTRAINT "MealCompletion_planId_fkey";
