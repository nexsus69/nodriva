BEGIN;

ALTER TABLE user_mfa_totp ADD COLUMN IF NOT EXISTS pending_secret_ciphertext TEXT;
ALTER TABLE user_mfa_totp ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;

COMMIT;
