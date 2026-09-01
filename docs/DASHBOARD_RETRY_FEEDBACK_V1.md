# Dashboard retry feedback v1

The authenticated dashboard data-error card now exposes an assertive, atomic error region with an associated heading. Retrying runs inside a React transition, rejects duplicate activation while pending, disables the retry button, and displays an honest “Retrying…” label until the server refresh completes.

The existing data and authorization boundaries are unchanged. This slice does not bypass owner-scoped queries, invent dashboard metrics, change database state, enable a feature flag, or contact an external provider.

Focused static contract coverage protects the error-region semantics, pending state, duplicate-request guard, and server refresh path. Authenticated browser/device and assistive-technology testing remain separate release evidence.
