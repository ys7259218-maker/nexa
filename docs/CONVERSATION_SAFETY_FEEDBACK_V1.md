# Conversation safety feedback v1

## Scope

The rollout-gated conversation human-takeover control now reports pending, success, and failure states through focused accessible feedback. Success wording distinguishes conversation-level eligibility from permission to generate a draft.

## Honest safety semantics

- Human takeover blocks AI drafts for the conversation while inbound history may still be retained.
- Returning a conversation to AI draft eligibility does not override workspace, employee, channel, or customer opt-out gates.
- Customer opt-out remains read-only on this screen.
- Viewer access remains read-only.
- The existing guarded RPC and workspace-scoped database policies remain authoritative.

This UI feedback does not prove that the conversation-safety migration or role matrix has been verified. `CONVERSATION_SAFETY_ENABLED` must remain false until the documented dedicated-project tests pass.

## Non-goals

No schema or migration change, live database access, deployment, feature-flag change, provider/account change, customer data, secret, outbound message, or opt-out clearing is included.
