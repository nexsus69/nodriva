# Nodriva Documentation Migration

## Purpose

Nodriva keeps its public repository documentation in English. Italian working
notes and historical material remain available locally under `docs-italiano/`,
which is intentionally ignored by Git.

`AGENTS.md` remains at the repository root because it is an operational
instruction file consumed by repository tooling. It is not part of the public
product documentation set.

## Rules

- Public Markdown files, code comments, and exported API documentation use
  English.
- Italian documents are copied to `docs-italiano/` before their tracked English
  replacements are created.
- Historical requirements are translated without changing their historical
  meaning; current behavior is documented separately.
- Product references use **Nodriva**. Compatibility identifiers such as Docker
  compose project names, package scopes, and filesystem paths are changed only
  with an explicit migration.
- Documentation changes must not disclose secrets, local credentials, or
  operational private paths.

## Migration status

The Italian working set has been staged locally. English replacements are being
created incrementally, starting with normative architecture, operations, and
release documents. The source-code documentation inventory is recorded in
`docs/SOURCE_DOCUMENTATION_INVENTORY.md`.
