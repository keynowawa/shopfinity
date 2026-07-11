-- ============================================================
--  Migration: Allow one review per user per product PER ORDER
--  Run this once in Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Add order_id column to reviews (nullable for backwards compat)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- 2. Drop the old unique constraint (user_id, product_id)
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_product_id_user_id_key;

-- 3. Add new unique constraint: one review per user per product per order
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_product_order_key
  UNIQUE (user_id, product_id, order_id);

-- 4. Index on order_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews (order_id);
