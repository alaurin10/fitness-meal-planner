-- AlterTable
ALTER TABLE "ProgressLog" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "GarminConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garminUserId" TEXT,
    "encryptedTokens" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'never',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWellness" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "steps" INTEGER,
    "totalKilocalories" INTEGER,
    "activeKilocalories" INTEGER,
    "restingHeartRate" INTEGER,
    "sleepSeconds" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWellness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarminConnection_userId_key" ON "GarminConnection"("userId");

-- CreateIndex
CREATE INDEX "DailyWellness_userId_dayKey_idx" ON "DailyWellness"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWellness_userId_dayKey_key" ON "DailyWellness"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressLog_userId_source_externalId_key" ON "ProgressLog"("userId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_userId_source_externalId_key" ON "ActivityLog"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "GarminConnection" ADD CONSTRAINT "GarminConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWellness" ADD CONSTRAINT "DailyWellness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

