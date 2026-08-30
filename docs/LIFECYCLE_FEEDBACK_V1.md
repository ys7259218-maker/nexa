# Employee lifecycle feedback v1

Status: implemented behind the existing disabled lifecycle rollout gate.

## Included

- Lifecycle transition controls expose pending state while the guarded transition RPC runs.
- Focused live feedback distinguishes validation or operation failures from successful transitions.
- Success text states honestly that non-Active states keep employee automation paused.
- Moving to Active still states that workspace and channel safety gates continue to apply.
- Existing activation-readiness checks continue to disable Active until every requirement passes.

The authenticated Supabase browser client, guarded lifecycle RPC, allowed-transition map, activation evidence boundary, workspace/channel safety enforcement, audit behavior, and rollout flag are unchanged. No migration, live database action, deployment, flag/provider enablement, production/customer data access, secret, outbound message, or external-account change is included.

This is a bounded feedback/accessibility improvement, not dedicated-project proof of the lifecycle migration, role matrix, or activation path.
