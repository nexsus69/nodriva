BEGIN;

UPDATE node_type_fields SET encryption_mode = 'plaintext' WHERE encryption_mode = 'inherit';
UPDATE entity_type_fields SET encryption_mode = 'plaintext' WHERE encryption_mode = 'inherit';
UPDATE node_type_attachment_policies SET encryption_mode = 'disabled' WHERE encryption_mode = 'inherit';

ALTER TABLE node_type_fields DROP CONSTRAINT IF EXISTS node_type_fields_encryption_mode_check;
ALTER TABLE entity_type_fields DROP CONSTRAINT IF EXISTS entity_type_fields_encryption_mode_check;
ALTER TABLE node_type_attachment_policies DROP CONSTRAINT IF EXISTS node_type_attachment_policies_encryption_mode_check;

ALTER TABLE node_type_fields ALTER COLUMN encryption_mode SET DEFAULT 'plaintext';
ALTER TABLE entity_type_fields ALTER COLUMN encryption_mode SET DEFAULT 'plaintext';
ALTER TABLE node_type_attachment_policies ALTER COLUMN encryption_mode SET DEFAULT 'disabled';

ALTER TABLE node_type_fields ADD CONSTRAINT node_type_fields_encryption_mode_check CHECK (encryption_mode IN ('plaintext', 'encrypted'));
ALTER TABLE entity_type_fields ADD CONSTRAINT entity_type_fields_encryption_mode_check CHECK (encryption_mode IN ('plaintext', 'encrypted'));
ALTER TABLE node_type_attachment_policies ADD CONSTRAINT node_type_attachment_policies_encryption_mode_check CHECK (encryption_mode IN ('enabled', 'disabled'));

COMMIT;
