-- Create Platform table if missing
CREATE TABLE IF NOT EXISTS "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Platform_name_key" ON "Platform"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Platform_slug_key" ON "Platform"("slug");

-- Add platformId to Game if missing
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "platformId" TEXT;

CREATE INDEX IF NOT EXISTS "Game_platformId_idx" ON "Game"("platformId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_title_key') THEN
    ALTER TABLE "Game" DROP CONSTRAINT "Game_title_key";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Game_title_platformId_key" ON "Game"("title", "platformId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_platformId_fkey') THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_platformId_fkey"
      FOREIGN KEY ("platformId") REFERENCES "Platform"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
