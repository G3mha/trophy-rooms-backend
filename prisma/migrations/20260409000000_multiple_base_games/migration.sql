-- CreateTable
CREATE TABLE "_GameBaseGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameBaseGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GameBaseGames_B_index" ON "_GameBaseGames"("B");

-- Migrate existing baseGameId data to the new join table
-- A = derived game id, B = base game id
INSERT INTO "_GameBaseGames" ("A", "B")
SELECT "id", "baseGameId" FROM "Game" WHERE "baseGameId" IS NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Game_baseGameId_idx";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT IF EXISTS "Game_baseGameId_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN IF EXISTS "baseGameId";

-- AddForeignKey
ALTER TABLE "_GameBaseGames" ADD CONSTRAINT "_GameBaseGames_A_fkey" FOREIGN KEY ("A") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameBaseGames" ADD CONSTRAINT "_GameBaseGames_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
