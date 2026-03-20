-- CreateTable
CREATE TABLE "GameVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "includedDlc" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("id")
);

-- Add gameVersionId to AchievementSet
ALTER TABLE "AchievementSet" ADD COLUMN "gameVersionId" TEXT;

-- Add gameVersionId to UserGame
ALTER TABLE "UserGame" ADD COLUMN "gameVersionId" TEXT;

-- Add gameVersionId to CollectionItem
ALTER TABLE "CollectionItem" ADD COLUMN "gameVersionId" TEXT;

-- CreateIndex
CREATE INDEX "GameVersion_gameId_idx" ON "GameVersion"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameVersion_gameId_slug_key" ON "GameVersion"("gameId", "slug");

-- CreateIndex
CREATE INDEX "AchievementSet_gameVersionId_idx" ON "AchievementSet"("gameVersionId");

-- CreateIndex
CREATE INDEX "UserGame_gameVersionId_idx" ON "UserGame"("gameVersionId");

-- CreateIndex
CREATE INDEX "CollectionItem_gameVersionId_idx" ON "CollectionItem"("gameVersionId");

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: Create "Standard" version for each existing game
INSERT INTO "GameVersion" ("id", "name", "slug", "isDefault", "gameId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'Standard',
    'standard',
    true,
    "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Game";
