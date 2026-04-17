-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "weightLbs" DOUBLE PRECISION,
    "heightIn" DOUBLE PRECISION,
    "experienceLevel" TEXT NOT NULL,
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "planJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightLbs" DOUBLE PRECISION,
    "note" TEXT,
    "liftPRs" JSONB,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FitProfile_userId_key" ON "FitProfile"("userId");

-- CreateIndex
CREATE INDEX "WeeklyPlan_userId_isActive_idx" ON "WeeklyPlan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WeeklyPlan_userId_weekStartDate_idx" ON "WeeklyPlan"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "ProgressLog_userId_loggedAt_idx" ON "ProgressLog"("userId", "loggedAt");

-- AddForeignKey
ALTER TABLE "FitProfile" ADD CONSTRAINT "FitProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
