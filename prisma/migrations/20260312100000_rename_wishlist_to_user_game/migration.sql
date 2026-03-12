-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WISHLIST', 'BACKLOG', 'PLAYING', 'PAUSED', 'COMPLETED', 'DROPPED');

-- Add status column to Wishlist with default WISHLIST
ALTER TABLE "Wishlist" ADD COLUMN "status" "GameStatus" NOT NULL DEFAULT 'WISHLIST';

-- Add updatedAt column
ALTER TABLE "Wishlist" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Rename table from Wishlist to UserGame
ALTER TABLE "Wishlist" RENAME TO "UserGame";

-- Rename the unique index
ALTER INDEX "Wishlist_userId_gameId_key" RENAME TO "UserGame_userId_gameId_key";

-- Rename existing indexes
ALTER INDEX "Wishlist_userId_idx" RENAME TO "UserGame_userId_idx";
ALTER INDEX "Wishlist_gameId_idx" RENAME TO "UserGame_gameId_idx";

-- Add new composite index for userId + status
CREATE INDEX "UserGame_userId_status_idx" ON "UserGame"("userId", "status");

-- Rename foreign key constraints
ALTER TABLE "UserGame" RENAME CONSTRAINT "Wishlist_userId_fkey" TO "UserGame_userId_fkey";
ALTER TABLE "UserGame" RENAME CONSTRAINT "Wishlist_gameId_fkey" TO "UserGame_gameId_fkey";
