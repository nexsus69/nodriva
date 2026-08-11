-- Metadata events are broadcast on global policy channels. A dedicated
-- sequence lets clients detect missed metadata events without treating
-- unauthorized resource events as gaps.
CREATE SEQUENCE IF NOT EXISTS realtime_metadata_event_sequence;
