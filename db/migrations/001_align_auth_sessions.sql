-- Consolidates the authentication schema on user_sessions.
--
-- Legacy sessions are deliberately left in place here. Migration 009 converts
-- raw tokens into the canonical hashed representation and only then removes
-- the legacy table, including installations where it contains active rows.

DO $$
BEGIN
  -- Kept as a DO block so this migration remains harmless on both schema
  -- generations. The conversion needs pgcrypto and is performed in 009.
  PERFORM to_regclass('public.sessions');
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_sessions(session_token_hash);
