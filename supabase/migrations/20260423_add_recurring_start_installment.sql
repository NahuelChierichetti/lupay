-- Add start_installment column (was missing from initial migration but used by the app)
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS start_installment INTEGER NOT NULL DEFAULT 1;

-- Allow NULL total_installments for recurring/indefinite expenses (e.g. monthly subscriptions)
ALTER TABLE installments
  ALTER COLUMN total_installments DROP NOT NULL;
