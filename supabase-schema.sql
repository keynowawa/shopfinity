-- ============================================================
--  ShopFresh — Complete Database Schema
--  Run this in Supabase Dashboard → SQL Editor → Run
--
--  Design decisions:
--   • All primary keys are UUIDs (gen_random_uuid())
--   • Products only exist when a merchant adds them
--   • Static/hardcoded products have been removed from app.js
--   • order_items references products.id (UUID) exclusively
--   • reviews.user_id is a proper FK to users.id
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- provides gen_random_uuid()

-- ─────────────────────────────────────────────────────────────
-- 1. CATEGORIES
--    Lookup table for product categories.
--    IDs match the CATEGORY_MAP in merchant.html.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER      PRIMARY KEY,
  name        TEXT         NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed the five categories used across the project
INSERT INTO categories (id, name) VALUES
  (6,  'Food'),
  (7,  'Electronics'),
  (8,  'Clothing'),
  (9,  'Home & Garden'),
  (10, 'Sports')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. USERS
--    Shared table for both customer and merchant accounts.
--    Passwords are hashed client-side (demo only — use Supabase
--    Auth or bcrypt for production).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT         NOT NULL UNIQUE,
  name           TEXT         NOT NULL,
  password_hash  TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─────────────────────────────────────────────────────────────
-- 3. MERCHANTS
--    Every merchant account links to a users row.
--    store_id is the human-readable identifier used by VERA
--    (matches credentialSubject.storeID in the BBS+ credential).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchants (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name     TEXT         NOT NULL,
  store_id       TEXT         UNIQUE,          -- e.g. STR-GRNLEAF-014 (VERA storeID)
  business_name  TEXT,                         -- category / business type label
  owner_name     TEXT,
  phone          TEXT,
  description    TEXT,
  logo_url       TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants (user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. PRODUCTS
--    Single unified table for all products.
--    Every product must be added by a merchant — merchant_id
--    is NOT NULL and references merchants.id.
--    Removing a merchant cascades to soft-delete their products
--    (status → 'deleted') rather than hard-delete to preserve
--    order history.  A trigger below handles this.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID         NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  product_name   TEXT         NOT NULL,
  category_id    INTEGER      REFERENCES categories(id),
  status         TEXT         NOT NULL DEFAULT 'Active'
                                CHECK (status IN ('Active', 'Draft', 'Out of Stock', 'Deleted')),
  price          NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock          INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku            TEXT,
  emoji          TEXT         DEFAULT '📦',   -- kept as fallback when no images uploaded
  image_urls     TEXT[]       DEFAULT '{}',   -- up to 5 public image URLs (Supabase Storage)
  description    TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_merchant  ON products (merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products (category_id);

-- ─────────────────────────────────────────────────────────────
-- 5. CARTS  +  CART_ITEMS
--    One open cart per user at a time (enforced in app logic).
--    cart_items.product_id references products(id).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID         NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER      NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart    ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items (product_id);

-- ─────────────────────────────────────────────────────────────
-- 6. ORDERS  +  ORDER_ITEMS
--    orders.user_id → users(id)
--    order_items.product_id → products(id)  (single UUID FK,
--    replaces the old split product_id / merchant_product_id)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT          NOT NULL UNIQUE,      -- e.g. SF-A1B2C3
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal         NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  payment_method   TEXT          NOT NULL,             -- cash_on_delivery | gcash | maya | visa | …
  payment_status   TEXT          NOT NULL DEFAULT 'pending'
                                   CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  order_status     TEXT          NOT NULL DEFAULT 'pending'
                                   CHECK (order_status IN ('pending', 'shipped', 'delivered', 'received', 'cancelled')),
  shipping_address TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number     ON orders (order_number);

CREATE TABLE IF NOT EXISTS order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price  NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- ─────────────────────────────────────────────────────────────
-- 7. REVIEWS
--    user_id is a proper FK to users(id).
--    product_id is a proper FK to products(id).
--    user_name is kept for display convenience.
--    One review per user per product is enforced.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id               UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name             TEXT         NOT NULL,
  rating                INTEGER      NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text                  TEXT,
  verified_purchase     BOOLEAN      DEFAULT FALSE,
  verified_id           BOOLEAN      DEFAULT FALSE,
  id_verification_score INTEGER      DEFAULT 0 CHECK (id_verification_score >= 0 AND id_verification_score <= 100),
  merchant_reply        TEXT,
  merchant_reply_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (product_id, user_id)   -- one review per user per product
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON reviews (user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. USER VERIFICATIONS
--    user_id FK → users(id).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_verifications (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_type              TEXT         NOT NULL,      -- passport | national-id | drivers-license | email
  id_number            TEXT         NOT NULL,
  verification_status  TEXT         DEFAULT 'pending'
                                      CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_score   INTEGER      DEFAULT 0 CHECK (verification_score >= 0 AND verification_score <= 100),
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_user ON user_verifications (user_id);

-- ─────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
--    Permissive policies for the client-side demo.
--    Tighten these for production (scope reads/writes by auth.uid()).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running this script
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public categories access"     ON categories;
  DROP POLICY IF EXISTS "Public users access"          ON users;
  DROP POLICY IF EXISTS "Public merchants access"      ON merchants;
  DROP POLICY IF EXISTS "Public products access"       ON products;
  DROP POLICY IF EXISTS "Public carts access"          ON carts;
  DROP POLICY IF EXISTS "Public cart_items access"     ON cart_items;
  DROP POLICY IF EXISTS "Public orders access"         ON orders;
  DROP POLICY IF EXISTS "Public order_items access"    ON order_items;
  DROP POLICY IF EXISTS "Public reviews access"        ON reviews;
  DROP POLICY IF EXISTS "Public verifications access"  ON user_verifications;
END $$;

CREATE POLICY "Public categories access"     ON categories        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public users access"          ON users             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public merchants access"      ON merchants         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public products access"       ON products          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public carts access"          ON carts             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public cart_items access"     ON cart_items        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public orders access"         ON orders            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public order_items access"    ON order_items       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public reviews access"        ON reviews           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public verifications access"  ON user_verifications FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 10. GRANT API ACCESS  (anon + authenticated roles)
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
