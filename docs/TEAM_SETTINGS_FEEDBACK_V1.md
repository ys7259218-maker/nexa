# Team Settings feedback v1

## Scope

The rollout-gated Team Settings role selector now reports pending, success, and failure states through focused accessible feedback. A failed mutation restores the server-provided role instead of leaving a misleading selection visible.

## Authority and safety

- The existing guarded role-update RPC and database protections remain authoritative.
- Owner/Admin eligibility is still derived from the current workspace membership.
- The final Owner, Owner-role changes, workspace identity, and cross-workspace boundaries remain database enforced.
- Viewer and Operator members remain unable to edit roles.

This UI feedback does not prove that the Team Management migration is applied or verified. `TEAM_MANAGEMENT_ENABLED` must remain false until the documented dedicated-project role and RLS checks pass.

## Non-goals

No invitation flow, schema or migration change, live database access, deployment, feature-flag change, provider/account change, customer data, secret, or outbound message is included.
