-- CreateEnum
CREATE TYPE "ShowcaseList" AS ENUM ('ALL_TIME', 'PLATINUMS', 'COLLECTION');

-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('X', 'BLUESKY', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITCH', 'DISCORD', 'STEAM', 'PSN', 'XBOX', 'NINTENDO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "bio" TEXT;

-- CreateTable
CREATE TABLE "UserSocialLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "handle" TEXT NOT NULL,

    CONSTRAINT "UserSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileShowcaseEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "list" "ShowcaseList" NOT NULL,
    "gameFamilyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProfileShowcaseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSocialLink_userId_network_key" ON "UserSocialLink"("userId", "network");

-- CreateIndex
CREATE INDEX "ProfileShowcaseEntry_gameFamilyId_idx" ON "ProfileShowcaseEntry"("gameFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileShowcaseEntry_userId_list_gameFamilyId_key" ON "ProfileShowcaseEntry"("userId", "list", "gameFamilyId");

-- AddForeignKey
ALTER TABLE "UserSocialLink" ADD CONSTRAINT "UserSocialLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileShowcaseEntry" ADD CONSTRAINT "ProfileShowcaseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileShowcaseEntry" ADD CONSTRAINT "ProfileShowcaseEntry_gameFamilyId_fkey" FOREIGN KEY ("gameFamilyId") REFERENCES "GameFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

