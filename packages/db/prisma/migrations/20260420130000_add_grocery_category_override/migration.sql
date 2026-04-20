-- CreateTable
CREATE TABLE "GroceryCategoryOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryCategoryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroceryCategoryOverride_userId_name_key" ON "GroceryCategoryOverride"("userId", "name");

-- CreateIndex
CREATE INDEX "GroceryCategoryOverride_userId_idx" ON "GroceryCategoryOverride"("userId");

-- AddForeignKey
ALTER TABLE "GroceryCategoryOverride" ADD CONSTRAINT "GroceryCategoryOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
