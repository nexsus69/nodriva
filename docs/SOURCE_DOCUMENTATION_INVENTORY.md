# Source Documentation Inventory

## Scope

This inventory covers TypeScript and TSX source under `packages/core` and
`packages/web`. Tests are included for analysis but are not a target for
repetitive comments unless a test fixture encodes a non-obvious contract.

## Baseline

The current repository contains approximately:

| Item | Count |
| --- | ---: |
| TypeScript/TSX/JavaScript source files in the repository scope | 610 |
| Function-like declarations in Core/Web source | 1,423 |
| Classes, interfaces, and type declarations | 835 |
| Top-level variable declarations | 4,191 |

These counts are an initial lexical inventory, not a semantic AST report. The
patterns intentionally over-count overloaded methods and declarations embedded
in tests, so they must not be used as a blind rewrite target.

## Documentation contract

Every public class, interface, type, function, hook, controller, service, and
adapter must have an English explanation immediately before its declaration.
The explanation states its responsibility, inputs, outputs, side effects, and
important invariants where applicable.

Variables are documented in English when they represent a policy, state
transition, cache key, protocol payload, security boundary, persistence value,
or a related group of values. Trivial local aliases and obvious loop indices do
not receive noise comments; their names and types are the documentation.

Comments must explain *why* and the observable contract, not restate syntax.
They must be kept synchronized with code and covered by the same review as the
implementation.

## Exclusions

- Generated output, dependencies, lockfiles, and build artifacts.
- Test-local primitives whose purpose is already explicit from the assertion.
- Comments that merely translate an identifier or repeat its type.

## Review sequence

1. Domain and application public contracts.
2. Persistence ports and PostgreSQL/SQLite adapters.
3. Cache kernel, realtime, and server controllers.
4. UI hooks, screens, and presentational boundaries.
5. Tests and operational scripts where the behavior is not self-evident.

## Future-file guard

The `docs:source` check runs in CI for added or modified Core/Web TypeScript
files. It requires an English module-purpose comment near the top of every
changed source file. This is the minimum guard for new files; declaration-level
comments remain part of code review and are required for every new public
function, class, interface, type, hook, controller, service, adapter, or
meaningful state group.
