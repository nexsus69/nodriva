# Known trade-offs

This document records accepted architectural trade-offs that may be optimized
later. Extensible resources share one authoritative aggregate `rowVersion` for
locks, conditional writes and conflict detection. A change to any specialized
face therefore invalidates a broader cache projection than some lists strictly
need. This is an efficiency cost, not a correctness defect.

When measured load justifies it, introduce a small invalidation contract with
tests and preserve the aggregate version invariant. Do not replace it with
independent versions without an explicit migration and concurrency analysis.
