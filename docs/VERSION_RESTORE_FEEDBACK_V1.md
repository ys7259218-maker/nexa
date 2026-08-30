# Employee version restore feedback v1

## Scope

The rollout-gated employee version-history screen now exposes button pending state and focused accessible success or failure feedback after a restore attempt.

## Honest restore boundary

- A successful restore keeps the prior settings snapshot in immutable history.
- Restore changes only the bounded settings snapshot owned by the existing guarded RPC.
- Lifecycle status, employee automation pause, channel assignment, and workspace safety controls remain unchanged.
- Database role checks, workspace scope, snapshot validation, and audit behavior remain authoritative.

This UI feedback does not prove that the version-history migration or role matrix has been verified. `EMPLOYEE_VERSION_HISTORY_ENABLED` must remain false until the documented dedicated-project restore, role, and cross-workspace checks pass.

## Non-goals

No schema or migration change, live database access, deployment, feature-flag change, provider/account change, customer data, secret, outbound message, or bulk restore is included.
