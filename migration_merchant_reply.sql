-- ============================================================
--  Migration: Add merchant reply columns to reviews table
--  Run this once in Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS merchant_reply     TEXT,
  ADD COLUMN IF NOT EXISTS merchant_reply_at  TIMESTAMPTZ;
