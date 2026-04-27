-- CreateTable
CREATE TABLE "WorkoutCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "setsJson" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkoutCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "indicesJson" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MealCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCompletion_userId_planId_dayKey_key" ON "WorkoutCompletion"("userId", "planId", "dayKey");

-- CreateIndex
CREATE INDEX "WorkoutCompletion_userId_dayKey_idx" ON "WorkoutCompletion"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "MealCompletion_userId_planId_dayKey_key" ON "MealCompletion"("userId", "planId", "dayKey");

-- CreateIndex
CREATE INDEX "MealCompletion_userId_dayKey_idx" ON "MealCompletion"("userId", "dayKey");

-- AddForeignKey
ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyMealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
