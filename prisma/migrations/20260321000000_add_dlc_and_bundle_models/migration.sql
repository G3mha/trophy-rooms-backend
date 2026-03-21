-- CreateEnum
CREATE TYPE "DLCType" AS ENUM ('DLC', 'EXPANSION', 'FREE_UPDATE');

-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('BUNDLE', 'SEASON_PASS', 'COLLECTION', 'SUBSCRIPTION');

-- AlterTable
ALTER TABLE "AchievementSet" ADD COLUMN     "dlcId" TEXT;

-- AlterTable
ALTER TABLE "GameVersion" DROP COLUMN "includedDlc";

-- CreateTable
CREATE TABLE "DLC" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "DLCType" NOT NULL DEFAULT 'DLC',
    "description" TEXT,
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "price" DOUBLE PRECISION,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDLC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dlcId" TEXT NOT NULL,
    "ownedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "BundleType" NOT NULL DEFAULT 'BUNDLE',
    "description" TEXT,
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "price" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBundle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "ownedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameVersionDLCs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameVersionDLCs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BundleGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BundleGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BundleDLCs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BundleDLCs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "DLC_gameId_idx" ON "DLC"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "DLC_gameId_slug_key" ON "DLC"("gameId", "slug");

-- CreateIndex
CREATE INDEX "UserDLC_userId_idx" ON "UserDLC"("userId");

-- CreateIndex
CREATE INDEX "UserDLC_dlcId_idx" ON "UserDLC"("dlcId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDLC_userId_dlcId_key" ON "UserDLC"("userId", "dlcId");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- CreateIndex
CREATE INDEX "Bundle_type_idx" ON "Bundle"("type");

-- CreateIndex
CREATE INDEX "UserBundle_userId_idx" ON "UserBundle"("userId");

-- CreateIndex
CREATE INDEX "UserBundle_bundleId_idx" ON "UserBundle"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBundle_userId_bundleId_key" ON "UserBundle"("userId", "bundleId");

-- CreateIndex
CREATE INDEX "_GameVersionDLCs_B_index" ON "_GameVersionDLCs"("B");

-- CreateIndex
CREATE INDEX "_BundleGames_B_index" ON "_BundleGames"("B");

-- CreateIndex
CREATE INDEX "_BundleDLCs_B_index" ON "_BundleDLCs"("B");

-- CreateIndex
CREATE INDEX "AchievementSet_dlcId_idx" ON "AchievementSet"("dlcId");

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_dlcId_fkey" FOREIGN KEY ("dlcId") REFERENCES "DLC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DLC" ADD CONSTRAINT "DLC_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDLC" ADD CONSTRAINT "UserDLC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDLC" ADD CONSTRAINT "UserDLC_dlcId_fkey" FOREIGN KEY ("dlcId") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBundle" ADD CONSTRAINT "UserBundle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBundle" ADD CONSTRAINT "UserBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionDLCs" ADD CONSTRAINT "_GameVersionDLCs_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionDLCs" ADD CONSTRAINT "_GameVersionDLCs_B_fkey" FOREIGN KEY ("B") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleGames" ADD CONSTRAINT "_BundleGames_A_fkey" FOREIGN KEY ("A") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleGames" ADD CONSTRAINT "_BundleGames_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleDLCs" ADD CONSTRAINT "_BundleDLCs_A_fkey" FOREIGN KEY ("A") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleDLCs" ADD CONSTRAINT "_BundleDLCs_B_fkey" FOREIGN KEY ("B") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;
