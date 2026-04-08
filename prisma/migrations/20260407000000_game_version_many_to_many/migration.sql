-- CreateTable for the implicit many-to-many junction table
CREATE TABLE "_GameVersionGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameVersionGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GameVersionGames_B_index" ON "_GameVersionGames"("B");

-- DEDUPLICATION STRATEGY:
-- For each unique slug, we keep ONE version and link all games that had versions with that slug

-- Step 1: Create a temp table with the canonical version ID for each slug (using MIN to pick one)
CREATE TEMP TABLE canonical_versions AS
SELECT slug, MIN(id) as canonical_id
FROM "GameVersion"
GROUP BY slug;

-- Step 2: Update related tables to point to canonical version
UPDATE "AchievementSet" as target
SET "gameVersionId" = cv.canonical_id
FROM "GameVersion" gv, canonical_versions cv
WHERE target."gameVersionId" = gv.id
AND gv.slug = cv.slug
AND gv.id != cv.canonical_id;

UPDATE "UserGame" as target
SET "gameVersionId" = cv.canonical_id
FROM "GameVersion" gv, canonical_versions cv
WHERE target."gameVersionId" = gv.id
AND gv.slug = cv.slug
AND gv.id != cv.canonical_id;

UPDATE "CollectionItem" as target
SET "gameVersionId" = cv.canonical_id
FROM "GameVersion" gv, canonical_versions cv
WHERE target."gameVersionId" = gv.id
AND gv.slug = cv.slug
AND gv.id != cv.canonical_id;

UPDATE "BuylistItem" as target
SET "gameVersionId" = cv.canonical_id
FROM "GameVersion" gv, canonical_versions cv
WHERE target."gameVersionId" = gv.id
AND gv.slug = cv.slug
AND gv.id != cv.canonical_id;

-- Step 3: Migrate existing relationships to junction table
-- Link canonical versions to ALL games that had any version with that slug
INSERT INTO "_GameVersionGames" ("A", "B")
SELECT DISTINCT cv.canonical_id, gv."gameId"
FROM "GameVersion" gv
JOIN canonical_versions cv ON gv.slug = cv.slug
WHERE gv."gameId" IS NOT NULL;

-- Step 4: Delete duplicate versions (keeping only canonical ones)
DELETE FROM "GameVersion"
WHERE id NOT IN (SELECT canonical_id FROM canonical_versions);

-- Drop temp table
DROP TABLE canonical_versions;

-- DropForeignKey
ALTER TABLE "GameVersion" DROP CONSTRAINT IF EXISTS "GameVersion_gameId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "GameVersion_gameId_idx";

-- DropIndex (the old unique constraint that used gameId)
DROP INDEX IF EXISTS "GameVersion_gameId_slug_key";

-- AlterTable - drop gameId column
ALTER TABLE "GameVersion" DROP COLUMN IF EXISTS "gameId";

-- CreateIndex - now slug is globally unique (should succeed after deduplication)
CREATE UNIQUE INDEX "GameVersion_slug_key" ON "GameVersion"("slug");

-- AddForeignKey for junction table
ALTER TABLE "_GameVersionGames" ADD CONSTRAINT "_GameVersionGames_A_fkey" FOREIGN KEY ("A") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for junction table
ALTER TABLE "_GameVersionGames" ADD CONSTRAINT "_GameVersionGames_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
