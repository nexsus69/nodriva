-- Consolidates the authentication schema on user_sessions.
--
-- The legacy sessions table is removed only when it is empty. If it contains
-- data, the migration stops instead of silently deleting active sessions.

DO $$
BEGIN
  IF to_regclass('public.sessions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.sessions LIMIT 1) THEN
      RAISE EXCEPTION
        'Legacy public.sessions contains data; migrate those sessions explicitly before continuing';
    END IF;

    DROP TABLE public.sessions;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_sessions(session_token_hash);

