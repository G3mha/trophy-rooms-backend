-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AchievementSetType" AS ENUM ('OFFICIAL', 'COMPLETIONIST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AchievementSetVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'TRUSTED', 'ADMIN');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('BACKLOG', 'PLAYING', 'PAUSED', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "GameRegion" AS ENUM ('NTSC_U', 'PAL', 'NTSC_J', 'OTHER');

-- CreateEnum
CREATE TYPE "DLCType" AS ENUM ('DLC', 'EXPANSION', 'FREE_UPDATE');

-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('BUNDLE', 'SEASON_PASS', 'COLLECTION', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('BASE_GAME', 'FANGAME', 'ROM_HACK', 'MOD', 'DLC', 'EXPANSION');

-- CreateEnum
CREATE TYPE "BuylistPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('MINT', 'NEAR_MINT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "SellListItemStatus" AS ENUM ('ACTIVE', 'SOLD', 'REMOVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "consolePictureUrl" TEXT,
    "promotionalPictures" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRelease" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameFamily" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "searchTitle" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "developer" TEXT,
    "publisher" TEXT,
    "genre" TEXT,
    "esrbRating" TEXT,
    "screenshots" TEXT[],
    "releaseDate" TIMESTAMP(3),
    "type" "GameType" NOT NULL DEFAULT 'BASE_GAME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "gameFamilyId" TEXT,
    "platformId" TEXT,
    "releaseDate" TIMESTAMP(3),
    "coverUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "digitalOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVersionReleaseDate" (
    "gameId" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameVersionReleaseDate_pkey" PRIMARY KEY ("gameId","gameVersionId")
);

-- CreateTable
CREATE TABLE "AchievementSet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AchievementSetType" NOT NULL DEFAULT 'OFFICIAL',
    "visibility" "AchievementSetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "gameFamilyId" TEXT,
    "gameVersionId" TEXT,
    "dlcId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" "AchievementTier" NOT NULL DEFAULT 'BRONZE',
    "achievementSetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trophy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playedOn" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platformId" TEXT,
    "gameVersionId" TEXT,
    "status" "GameStatus" NOT NULL,
    "purchasePrice" DOUBLE PRECISION,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "bundleId" TEXT,
    "platformId" TEXT,
    "gameVersionId" TEXT,
    "hasDisc" BOOLEAN NOT NULL DEFAULT false,
    "hasBox" BOOLEAN NOT NULL DEFAULT false,
    "hasManual" BOOLEAN NOT NULL DEFAULT false,
    "hasExtras" BOOLEAN NOT NULL DEFAULT false,
    "isDigital" BOOLEAN NOT NULL DEFAULT false,
    "isSealed" BOOLEAN NOT NULL DEFAULT false,
    "region" "GameRegion" NOT NULL DEFAULT 'NTSC_U',
    "notes" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

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
    "gameFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDLC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dlcId" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION,
    "purchasedAt" TIMESTAMP(3),
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
CREATE TABLE "BuylistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameFamilyId" TEXT,
    "gameId" TEXT,
    "gameVersionId" TEXT,
    "dlcId" TEXT,
    "bundleId" TEXT,
    "priority" "BuylistPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "estimatedPrice" DOUBLE PRECISION,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "askingPrice" DOUBLE PRECISION,
    "condition" "ItemCondition" NOT NULL DEFAULT 'GOOD',
    "conditionNotes" TEXT,
    "listingUrl" TEXT,
    "notes" TEXT,
    "status" "SellListItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "salePrice" DOUBLE PRECISION,
    "soldAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameFamilyBaseGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameFamilyBaseGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GameVersionGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameVersionGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DLCPlatforms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DLCPlatforms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GameVersionDLCs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GameVersionDLCs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BundlePlatforms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BundlePlatforms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BundleGameFamilies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BundleGameFamilies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BundleDLCs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BundleDLCs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_name_key" ON "Platform"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE INDEX "PlatformRelease_platformId_idx" ON "PlatformRelease"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRelease_platformId_region_key" ON "PlatformRelease"("platformId", "region");

-- CreateIndex
CREATE UNIQUE INDEX "GameFamily_slug_key" ON "GameFamily"("slug");

-- CreateIndex
CREATE INDEX "GameFamily_type_idx" ON "GameFamily"("type");

-- CreateIndex
CREATE INDEX "GameFamily_searchTitle_idx" ON "GameFamily"("searchTitle");

-- CreateIndex
CREATE INDEX "Game_platformId_idx" ON "Game"("platformId");

-- CreateIndex
CREATE INDEX "Game_gameFamilyId_idx" ON "Game"("gameFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_gameFamilyId_platformId_key" ON "Game"("gameFamilyId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "GameVersion_slug_key" ON "GameVersion"("slug");

-- CreateIndex
CREATE INDEX "GameVersionReleaseDate_gameVersionId_idx" ON "GameVersionReleaseDate"("gameVersionId");

-- CreateIndex
CREATE INDEX "AchievementSet_gameFamilyId_idx" ON "AchievementSet"("gameFamilyId");

-- CreateIndex
CREATE INDEX "AchievementSet_gameVersionId_idx" ON "AchievementSet"("gameVersionId");

-- CreateIndex
CREATE INDEX "AchievementSet_dlcId_idx" ON "AchievementSet"("dlcId");

-- CreateIndex
CREATE INDEX "AchievementSet_createdByUserId_idx" ON "AchievementSet"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementSet_gameFamilyId_title_type_createdByUserId_key" ON "AchievementSet"("gameFamilyId", "title", "type", "createdByUserId");

-- CreateIndex
CREATE INDEX "Achievement_achievementSetId_idx" ON "Achievement"("achievementSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_achievementSetId_title_key" ON "Achievement"("achievementSetId", "title");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "Trophy_userId_idx" ON "Trophy"("userId");

-- CreateIndex
CREATE INDEX "Trophy_gameId_idx" ON "Trophy"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Trophy_userId_gameId_key" ON "Trophy"("userId", "gameId");

-- CreateIndex
CREATE INDEX "PlaySession_userId_playedOn_idx" ON "PlaySession"("userId", "playedOn");

-- CreateIndex
CREATE INDEX "PlaySession_userId_gameId_idx" ON "PlaySession"("userId", "gameId");

-- CreateIndex
CREATE INDEX "PlaySession_gameId_idx" ON "PlaySession"("gameId");

-- CreateIndex
CREATE INDEX "UserGame_userId_idx" ON "UserGame"("userId");

-- CreateIndex
CREATE INDEX "UserGame_gameId_idx" ON "UserGame"("gameId");

-- CreateIndex
CREATE INDEX "UserGame_platformId_idx" ON "UserGame"("platformId");

-- CreateIndex
CREATE INDEX "UserGame_gameVersionId_idx" ON "UserGame"("gameVersionId");

-- CreateIndex
CREATE INDEX "UserGame_userId_status_idx" ON "UserGame"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserGame_userId_gameId_key" ON "UserGame"("userId", "gameId");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_gameId_idx" ON "CollectionItem"("gameId");

-- CreateIndex
CREATE INDEX "CollectionItem_bundleId_idx" ON "CollectionItem"("bundleId");

-- CreateIndex
CREATE INDEX "CollectionItem_gameVersionId_idx" ON "CollectionItem"("gameVersionId");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_gameId_idx" ON "CollectionItem"("userId", "gameId");

-- CreateIndex
CREATE INDEX "DLC_gameFamilyId_idx" ON "DLC"("gameFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "DLC_gameFamilyId_slug_key" ON "DLC"("gameFamilyId", "slug");

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
CREATE INDEX "BuylistItem_userId_idx" ON "BuylistItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuylistItem_userId_gameFamilyId_gameId_gameVersionId_dlcId__key" ON "BuylistItem"("userId", "gameFamilyId", "gameId", "gameVersionId", "dlcId", "bundleId");

-- CreateIndex
CREATE INDEX "SellListItem_userId_idx" ON "SellListItem"("userId");

-- CreateIndex
CREATE INDEX "SellListItem_userId_status_idx" ON "SellListItem"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SellListItem_userId_collectionItemId_key" ON "SellListItem"("userId", "collectionItemId");

-- CreateIndex
CREATE INDEX "_GameFamilyBaseGames_B_index" ON "_GameFamilyBaseGames"("B");

-- CreateIndex
CREATE INDEX "_GameVersionGames_B_index" ON "_GameVersionGames"("B");

-- CreateIndex
CREATE INDEX "_DLCPlatforms_B_index" ON "_DLCPlatforms"("B");

-- CreateIndex
CREATE INDEX "_GameVersionDLCs_B_index" ON "_GameVersionDLCs"("B");

-- CreateIndex
CREATE INDEX "_BundlePlatforms_B_index" ON "_BundlePlatforms"("B");

-- CreateIndex
CREATE INDEX "_BundleGameFamilies_B_index" ON "_BundleGameFamilies"("B");

-- CreateIndex
CREATE INDEX "_BundleDLCs_B_index" ON "_BundleDLCs"("B");

-- AddForeignKey
ALTER TABLE "PlatformRelease" ADD CONSTRAINT "PlatformRelease_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_gameFamilyId_fkey" FOREIGN KEY ("gameFamilyId") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVersionReleaseDate" ADD CONSTRAINT "GameVersionReleaseDate_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVersionReleaseDate" ADD CONSTRAINT "GameVersionReleaseDate_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_gameFamilyId_fkey" FOREIGN KEY ("gameFamilyId") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_dlcId_fkey" FOREIGN KEY ("dlcId") REFERENCES "DLC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementSet" ADD CONSTRAINT "AchievementSet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_achievementSetId_fkey" FOREIGN KEY ("achievementSetId") REFERENCES "AchievementSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DLC" ADD CONSTRAINT "DLC_gameFamilyId_fkey" FOREIGN KEY ("gameFamilyId") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDLC" ADD CONSTRAINT "UserDLC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDLC" ADD CONSTRAINT "UserDLC_dlcId_fkey" FOREIGN KEY ("dlcId") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_gameFamilyId_fkey" FOREIGN KEY ("gameFamilyId") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_dlcId_fkey" FOREIGN KEY ("dlcId") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuylistItem" ADD CONSTRAINT "BuylistItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellListItem" ADD CONSTRAINT "SellListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellListItem" ADD CONSTRAINT "SellListItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameFamilyBaseGames" ADD CONSTRAINT "_GameFamilyBaseGames_A_fkey" FOREIGN KEY ("A") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameFamilyBaseGames" ADD CONSTRAINT "_GameFamilyBaseGames_B_fkey" FOREIGN KEY ("B") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionGames" ADD CONSTRAINT "_GameVersionGames_A_fkey" FOREIGN KEY ("A") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionGames" ADD CONSTRAINT "_GameVersionGames_B_fkey" FOREIGN KEY ("B") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCPlatforms" ADD CONSTRAINT "_DLCPlatforms_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DLCPlatforms" ADD CONSTRAINT "_DLCPlatforms_B_fkey" FOREIGN KEY ("B") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionDLCs" ADD CONSTRAINT "_GameVersionDLCs_A_fkey" FOREIGN KEY ("A") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameVersionDLCs" ADD CONSTRAINT "_GameVersionDLCs_B_fkey" FOREIGN KEY ("B") REFERENCES "GameVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundlePlatforms" ADD CONSTRAINT "_BundlePlatforms_A_fkey" FOREIGN KEY ("A") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundlePlatforms" ADD CONSTRAINT "_BundlePlatforms_B_fkey" FOREIGN KEY ("B") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleGameFamilies" ADD CONSTRAINT "_BundleGameFamilies_A_fkey" FOREIGN KEY ("A") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleGameFamilies" ADD CONSTRAINT "_BundleGameFamilies_B_fkey" FOREIGN KEY ("B") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleDLCs" ADD CONSTRAINT "_BundleDLCs_A_fkey" FOREIGN KEY ("A") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BundleDLCs" ADD CONSTRAINT "_BundleDLCs_B_fkey" FOREIGN KEY ("B") REFERENCES "DLC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

