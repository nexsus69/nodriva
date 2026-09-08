BEGIN;
CREATE TABLE IF NOT EXISTS account_action_delivery_outbox (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('invitation', 'password_reset')),
  token_ciphertext TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_action_delivery_outbox_pending
  ON account_action_delivery_outbox (created_at)
  WHERE delivered_at IS NULL;
COMMIT;
