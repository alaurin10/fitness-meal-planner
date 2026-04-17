/*
  Warnings:

  - You are about to drop the `FitProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgressLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeeklyPlan` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FitProfile" DROP CONSTRAINT "FitProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProgressLog" DROP CONSTRAINT "ProgressLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyPlan" DROP CONSTRAINT "WeeklyPlan_userId_fkey";

-- DropTable
DROP TABLE "FitProfile";

-- DropTable
DROP TABLE "ProgressLog";

-- DropTable
DROP TABLE "WeeklyPlan";

-- CreateTable
CREATE TABLE "MealProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caloricTarget" INTEGER,
    "proteinTargetG" INTEGER,
    "dietaryNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "planJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyMealPlanId" TEXT,
    "items" JSONB NOT NULL,
    "pushedToRemindersAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealProfile_userId_key" ON "MealProfile"("userId");

-- CreateIndex
CREATE INDEX "WeeklyMealPlan_userId_isActive_idx" ON "WeeklyMealPlan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WeeklyMealPlan_userId_weekStartDate_idx" ON "WeeklyMealPlan"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "GroceryList_userId_createdAt_idx" ON "GroceryList"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MealProfile" ADD CONSTRAINT "MealProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMealPlan" ADD CONSTRAINT "WeeklyMealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_weeklyMealPlanId_fkey" FOREIGN KEY ("weeklyMealPlanId") REFERENCES "WeeklyMealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
