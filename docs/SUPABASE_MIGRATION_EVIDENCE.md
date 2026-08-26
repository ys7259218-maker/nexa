# Supabase migration and isolation evidence template

Status: **not executed**

Use this template only for a dedicated Nexa test project with synthetic accounts and data. It is deliberately blank: repository packaging does not prove a live reset, hosted migration, RLS boundary, backup, or restore.

## Run identity

- Date/time (UTC):
- Operator:
- Reviewer:
- Git commit (full SHA):
- Target label (non-production only; no project URL/key):
- Supabase CLI/Postgres versions:
- Feature flags confirmed false before run:
- Outbound providers confirmed disabled:

## Backup and recovery preparation

- Backup identifier (redacted, no URL/token):
- Backup completion independently verified:
- Restore target label (isolated):
- Recovery owner:
- Recovery stop condition:

## Chain inventory

Record one result for every file. Do not skip or reorder rows.

| Version | Migration | Result | Start/end UTC | Redacted evidence reference |
| --- | --- | --- | --- | --- |
| `20260824000100` | `baseline_ai_employees` | Not run | | |
| `20260824000200` | `settings_dashboard` | Not run | | |
| `20260824000300` | `whatsapp_messaging` | Not run | | |
| `20260824000400` | `workspace_tenancy_foundation` | Not run | | |
| `20260824000500` | `workspace_tenancy_cutover` | Not run | | |
| `20260824000600` | `employee_lifecycle` | Not run | | |
| `20260824000700` | `audit_events` | Not run | | |
| `20260824000800` | `workspace_kill_switch` | Not run | | |
| `20260824000900` | `team_role_management` | Not run | | |

## Replay proof

- Fresh reset #1 result:
- Fresh reset #2 result:
- Existing synthetic-data upgrade result:
- Migration-history versions exactly match the manifest:
- Pre/post row-count reconciliation (counts only, no row contents):
- Unmapped or mismatched tenant rows: expected `0`; actual:
- Workspaces with no Owner: expected `0`; actual:
- Accounts without exactly one creator-owned personal workspace: expected `0`; actual:

## RLS and role proof

Synthetic account A and B must belong to different workspaces. Record pass/fail and a privacy-safe evidence reference, never credentials or row contents.

| Check | Expected | Result | Evidence reference |
| --- | --- | --- | --- |
| Account A cannot read B employee/message/channel rows | Denied or empty | Not run | |
| Account A cannot update/delete B employee rows | Denied or no rows | Not run | |
| Browser session cannot insert conversations/messages | Denied | Not run | |
| Browser session cannot read/write webhook ledger | Empty/denied | Not run | |
| Viewer cannot mutate employee/team/safety state | Denied | Not run | |
| Operator can use only approved employee operations | Allowed/denied per matrix | Not run | |
| Admin cannot grant or remove Owner | Denied | Not run | |
| Owner can perform approved role changes | Allowed | Not run | |
| Concurrent final-Owner demotion attempts | At least one denied; Owner retained | Not run | |
| Direct lifecycle field update | Denied | Not run | |
| Unsafe Active insert without fresh trusted evidence | Denied | Not run | |
| Audit row update/delete from client | Denied or no rows | Not run | |
| Workspace safety change through guarded RPC | Owner/Admin only | Not run | |

- `npm run test:integration` result with two synthetic accounts:
- Additional SQL/catalog policy inspection result:
- Feature flags still false after proof:
- Workspace and employees left paused after proof:

## Restore drill

- Restore began/completed UTC:
- Restored backup identifier (redacted):
- Restored row-count reconciliation:
- Restored migration-history verification:
- Post-restore RLS smoke result:
- Recovery time observed:
- Restore limitations or failures:

## Final decision

- ASTRA recommendation: `BLOCK` / `READY FOR CIPHER REVIEW`
- CIPHER review: `BLOCK` / `APPROVED FOR NEXT GATE`
- NEXA PRIME decision:
- Unresolved risks:
- Follow-up owners and dates:

Never change this status to executed or approved without linked evidence from the isolated run. Production rollout remains a separate decision and requires its own backup, approval, smoke, and rollback records.
