-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotHint" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "totalMinutes" INTEGER,
    "calories" INTEGER NOT NULL,
    "proteinG" INTEGER NOT NULL,
    "carbsG" INTEGER,
    "fatG" INTEGER,
    "ingredientsJson" JSONB NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipe_userId_isFavorite_idx" ON "Recipe"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "Recipe_userId_createdAt_idx" ON "Recipe"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
