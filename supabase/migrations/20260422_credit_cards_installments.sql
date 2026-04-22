-- ── Credit Cards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id        UUID REFERENCES spaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  bank            TEXT NOT NULL,
  last_four       TEXT,
  card_type       TEXT DEFAULT 'visa',
  color           TEXT DEFAULT '#1a237e',
  due_date_day    INTEGER DEFAULT 12,
  expiry          TEXT,
  credit_limit    NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

-- Owner can always manage their own rows
CREATE POLICY "credit_cards owner"
  ON credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Any space member can read cards that belong to the space
CREATE POLICY "credit_cards space read"
  ON credit_cards FOR SELECT
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = credit_cards.space_id
        AND space_members.user_id = auth.uid()
    )
  );

-- Space editors (non-owners) can insert/update/delete cards in the space
CREATE POLICY "credit_cards space editor write"
  ON credit_cards FOR ALL
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = credit_cards.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role = 'editor'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = credit_cards.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role = 'editor'
    )
  );

-- ── Installments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS installments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id              UUID REFERENCES spaces(id) ON DELETE CASCADE,
  credit_card_id        UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  description           TEXT NOT NULL,
  store                 TEXT,
  total_amount          NUMERIC NOT NULL DEFAULT 0,
  installment_amount    NUMERIC NOT NULL DEFAULT 0,
  total_installments    INTEGER NOT NULL DEFAULT 1,
  start_date            DATE NOT NULL,
  icon                  TEXT DEFAULT 'receipt',
  status                TEXT DEFAULT 'active',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installments owner"
  ON installments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installments space read"
  ON installments FOR SELECT
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = installments.space_id
        AND space_members.user_id = auth.uid()
    )
  );

CREATE POLICY "installments space editor write"
  ON installments FOR ALL
  USING (
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = installments.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role = 'editor'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    space_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM space_members
      WHERE space_members.space_id = installments.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role = 'editor'
    )
  );
