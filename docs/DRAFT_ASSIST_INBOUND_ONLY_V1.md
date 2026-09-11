# Draft-Assist Inbound-Only V1 — Design Proposal (NOT implemented)

Status: **Design-only proposal**. This document records the intended product,
why the code cannot be wired yet, and the separately approved lifecycle/schema
change required before any runtime implementation lands. No migration has been
created. The flag `INBOUND_DRAFT_ASSIST_ENABLED` exists only as a fail-closed
rollout gate (see `lib/deployPreflight.ts`); it has **no runtime effect** and
must stay `false`.

## Product intent

During inbound-only testing, a **Testing** AI Employee that is correctly
assigned to a test channel should be able to generate a stored, human-reviewable
reply rendered to a review surface. The reply is persisted as an outbound
message with status `draft_blocked` and a null `wa_message_id` and is **never
sent automatically**. Requiring a human review step keeps the inbound-only
boundary — a reply can leave WhatsApp only through the future outbound
approve-and-send flow.

## Why the implementation is unreachable today (do not bypass)

The canonical lifecycle migration
`supabase/migrations/20260824000600_employee_lifecycle.sql` makes the
"Testing + `automation_paused = false`" state impossible:

- `guard_ai_employee_lifecycle_write` insert trigger: every new AI employee must
  start as `Draft` with `automation_paused = true`.
- `ai_employees_active_not_paused_check`: `check (lifecycle_status = 'Active' or
  automation_paused = true)` — any non-Active employee must be paused.
- `transition_ai_employee_lifecycle` sets `automation_paused = (target_status <> 'Active')`
  on every transition.
- `set_ai_employee_automation_paused` rejects resuming a non-Active employee
  (`'Only an Active employee can resume automation'`).

A Testing employee that could draft **unpaused** therefore cannot exist under
the canonical schema. Adding code that drafts for an unpaused Testing employee
would either be dead code or, worse, would require weakening the pause /
kill-switch safety rule. PR #168 deliberately does neither: it removes the
unreachable draft-assist path from `lib/whatsappIngest.ts` (which remains
Active-and-unpaused-only) and replaces it with this proposal.

The pause kill-switch is a hard safety boundary: `automation_paused = true`
must continue to silence an employee (their channel stops drafting) no matter
their lifecycle status. Any future change must preserve that.

## Required separately approved lifecycle/schema change

Before Draft-Assist can be implemented and enabled, a **separate, explicitly
approved** migration must provide a controlled way for a Testing employee to be
unpaused without weakening the kill-switch. The proposal must cover:

1. A narrow transition that allows `lifecycle_status = 'Testing'` with
   `automation_paused = false` only under controlled conditions, e.g. a
   dedicated `Testing`-only "resume in test mode" RPC that verifies a labeled
   test channel and an explicit owner opt-in, audited like every other
   lifecycle write.
2. Preservation of the kill-switch for `Draft`, `Paused`, and `Archived`
   (`automation_paused = true` stays mandatory).
3. No change to activation evidence: reaching `Active` still requires fresh,
   complete, outbound-enabled evidence rows and the full content checklist.
4. A documented, tested opt-out / human-takeover path that pauses the Testing
   employee immediately.

Until that change is approved and applied, `INBOUND_DRAFT_ASSIST_ENABLED` must
remain `false` and drafting stays limited to Active, unpaused employees.

## Terminus must-haves for the future implementation

Any future implementation of this design must keep the following (regression
tests become part of that future PR):

- Never-send: replies persist as `draft_blocked` with `wa_message_id` null and
  never a `sent` status through the inbound path.
- Human takeover, send opt-out, workspace-level pause, unassigned channels,
  cross-workspace mismatches, and duplicate events all fail closed.
- The activation checklist is never weakened (see
  `lib/server/activationEvidence.test.ts`).
- `lib/deployPreflight.ts` fails any closed-beta deploy unless the flag is
  explicitly `false`.

## What this PR does instead

- Removes the unreachable Testing draft path; the inbound processor keeps its
  Active-and-unpaused only contract (unchanged behavior for real fixtures).
- Adds `INBOUND_DRAFT_ASSIST_ENABLED` to the closed-beta preflight gate
  (`SAFE_BETA_FLAGS`), fail-closed with explicit, focused tests.
- Documents the gap + required change here and in `.env.example`.