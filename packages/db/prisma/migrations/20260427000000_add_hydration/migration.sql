-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "hydrationGoal" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "HydrationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "cups" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HydrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HydrationLog_userId_date_idx" ON "HydrationLog"("userId", "date");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "HydrationLog_userId_date_key" ON "HydrationLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "HydrationLog" ADD CONSTRAINT "HydrationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
