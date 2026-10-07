-- AlterTable
ALTER TABLE "GameFamily" ADD COLUMN     "igdbId" INTEGER;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "igdbId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "GameFamily_igdbId_key" ON "GameFamily"("igdbId");

-- CreateIndex
CREATE INDEX "Game_igdbId_idx" ON "Game"("igdbId");

