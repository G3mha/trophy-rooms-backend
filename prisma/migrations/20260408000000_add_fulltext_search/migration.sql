-- Add full-text search capabilities to searchable catalog tables
-- Using PostgreSQL tsvector with GIN indexes for fast text search

-- ============================================
-- GAME FAMILY TABLE FULL-TEXT SEARCH
-- ============================================

-- Add search_vector column to GameFamily table
ALTER TABLE "GameFamily" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("developer", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("publisher", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("genre", '')), 'D')
  ) STORED;

-- Create GIN index for fast full-text search on GameFamily
CREATE INDEX "GameFamily_search_vector_idx" ON "GameFamily" USING GIN ("search_vector");

-- Also add a trigram index for fuzzy/partial matching on title
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "GameFamily_title_trgm_idx" ON "GameFamily" USING GIN ("title" gin_trgm_ops);

-- ============================================
-- ACHIEVEMENT TABLE FULL-TEXT SEARCH
-- ============================================

-- Add search_vector column to Achievement table
ALTER TABLE "Achievement" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- Create GIN index for fast full-text search on Achievement
CREATE INDEX "Achievement_search_vector_idx" ON "Achievement" USING GIN ("search_vector");

-- Also add a trigram index for fuzzy/partial matching on title
CREATE INDEX "Achievement_title_trgm_idx" ON "Achievement" USING GIN ("title" gin_trgm_ops);

-- ============================================
-- GAME VERSION TABLE FULL-TEXT SEARCH
-- ============================================

-- Add search_vector column to GameVersion table
ALTER TABLE "GameVersion" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- Create GIN index for fast full-text search on GameVersion
CREATE INDEX "GameVersion_search_vector_idx" ON "GameVersion" USING GIN ("search_vector");

-- ============================================
-- DLC TABLE FULL-TEXT SEARCH
-- ============================================

-- Add search_vector column to DLC table
ALTER TABLE "DLC" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- Create GIN index for fast full-text search on DLC
CREATE INDEX "DLC_search_vector_idx" ON "DLC" USING GIN ("search_vector");
