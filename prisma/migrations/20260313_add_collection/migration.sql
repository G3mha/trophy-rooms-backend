-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "GameRegion" AS ENUM ('NTSC_U', 'PAL', 'NTSC_J', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Rename constraint (if exists)
DO $$ BEGIN
    ALTER TABLE "UserGame" RENAME CONSTRAINT "Wishlist_pkey" TO "UserGame_pkey";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- AlterTable: Drop defaults (ignore if already dropped)
ALTER TABLE "UserGame" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "UserGame" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platformId" TEXT,
    "hasDisc" BOOLEAN NOT NULL DEFAULT false,
    "hasBox" BOOLEAN NOT NULL DEFAULT false,
    "hasManual" BOOLEAN NOT NULL DEFAULT false,
    "hasExtras" BOOLEAN NOT NULL DEFAULT false,
    "isSealed" BOOLEAN NOT NULL DEFAULT false,
    "region" "GameRegion" NOT NULL DEFAULT 'NTSC_U',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "CollectionItem_userId_idx" ON "CollectionItem"("userId");
CREATE INDEX IF NOT EXISTS "CollectionItem_gameId_idx" ON "CollectionItem"("gameId");
CREATE INDEX IF NOT EXISTS "CollectionItem_userId_gameId_idx" ON "CollectionItem"("userId", "gameId");

-- AddForeignKey (if not exists)
DO $$ BEGIN
    ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
