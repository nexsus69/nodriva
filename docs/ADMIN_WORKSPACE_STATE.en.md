# Administrative workspace state

The administrative workspace owns filters, drafts, selection and transient
errors for a screen. State transitions are implemented by hooks/controllers,
not by page composition or duplicated components.

Navigation, reload and realtime updates preserve unsaved drafts and active
filters where safe. Server responses remain authoritative for permissions,
validation, locks and `rowVersion`.
