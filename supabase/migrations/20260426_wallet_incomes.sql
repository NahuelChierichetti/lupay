-- ── Wallet Incomes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_incomes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id      UUID REFERENCES spaces(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC NOT NULL DEFAULT 0,
  expected_day  INTEGER DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  recurrence    TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'once')),
  month         TEXT,  -- YYYY-MM, only used when recurrence = 'once'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_incomes ENABLE ROW LEVEL SECURITY;

-- Owner can always manage their own rows
CREATE POLICY "wallet_incomes owner"
  ON wallet_incomes FOR ALL
  USING (auth.uid() = user_id);

-- Space members (editor/owner) can manage space incomes
CREATE POLICY "wallet_incomes space member"
  ON wallet_incomes FOR ALL
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = wallet_incomes.space_id
        AND sm.user_id  = auth.uid()
        AND sm.role IN ('owner', 'editor')
    )
  );

-- Space viewers can read
CREATE POLICY "wallet_incomes space viewer read"
  ON wallet_incomes FOR SELECT
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = wallet_incomes.space_id
        AND sm.user_id  = auth.uid()
    )
  );
