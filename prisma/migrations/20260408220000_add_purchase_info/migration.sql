-- Add purchase info to UserGame
ALTER TABLE "UserGame" ADD COLUMN "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "UserGame" ADD COLUMN "purchasedAt" TIMESTAMP(3);

-- Add purchase info to UserDLC
ALTER TABLE "UserDLC" ADD COLUMN "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "UserDLC" ADD COLUMN "purchasedAt" TIMESTAMP(3);

-- Add purchase info to UserBundle
ALTER TABLE "UserBundle" ADD COLUMN "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "UserBundle" ADD COLUMN "purchasedAt" TIMESTAMP(3);
