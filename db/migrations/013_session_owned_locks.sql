BEGIN;

ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- Existing locks predate session ownership and cannot be attributed safely
-- when the same user has multiple devices. Locks are ephemeral, so clearing
-- them is safer than assigning them to an arbitrary session.
DELETE FROM locks WHERE session_id IS NULL;

ALTER TABLE locks
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE locks
  DROP CONSTRAINT IF EXISTS locks_session_id_fkey;

ALTER TABLE locks
  ADD CONSTRAINT locks_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_locks_session_id ON locks(session_id);

COMMIT;
