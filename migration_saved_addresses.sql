-- ============================================================
--  Migration: Saved Addresses
--  Run this in Supabase Dashboard → SQL Editor → Run
--  Adds a saved_addresses table so users can store multiple
--  delivery addresses and pick one at checkout.
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_addresses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT,                          -- optional: "Home", "Office", etc.
  contact_name    TEXT          NOT NULL,
  contact_number  TEXT          NOT NULL,
  address         TEXT          NOT NULL,
  is_default      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user ON saved_addresses (user_id);

-- Only one default per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_addresses_default
  ON saved_addresses (user_id)
  WHERE is_default = TRUE;

-- ── Row Level Security (matches the pattern used by all other tables) ──
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public saved_addresses access" ON saved_addresses;
CREATE POLICY "Public saved_addresses access"
  ON saved_addresses FOR ALL
  USING (true) WITH CHECK (true);
