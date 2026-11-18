# B9 OPERATOR RUNBOOK — controlled product integration (flag-gated)

Status: implementation scope only. This runbook records what B9 added, what it
deliberately did not change, and the operator steps that remain owner-gated.

## What B9 adds

B9 is a narrow, read-only agent console surface for tasks already persisted by
the B1–B8 runtime. It adds **no** new task execution, no new approval action and
no new data store.

| Surface | Path | Reads |
|---|---|---|
| Task detail | `app/settings/agent-runtime/[id]/page.tsx` | `getVisibleAgentTask`, `listVisibleAgentEvents` (both RLS-scoped) |
| In-flight approvals | `app/settings/agent-runtime/approvals/page.tsx` | `listVisibleAgentTasks` filtered to `AWAITING_APPROVAL` |
| Content-free projection | `lib/agent/b9Console.ts` | pure functions; no store, clock, network or database |

The existing read-only console (`app/settings/agent-runtime/page.tsx`) gains
links to both views; it is otherwise unchanged.

## Content-free guarantee

Nothing rendered by a B9 view can contain customer text, a phone number, an
event payload or an evidence record:

- `toSafeB9Code` reduces arbitrary text to a bounded lowercase code or `other`.
- `projectB9TaskDetail` returns only state, timestamps, `cancelRequested`, a
  safe error class, an event count and event-type counters.
- `projectB9ApprovalQueue` returns only task id, state and timestamps.

`lib/uiContracts.test.ts` and `lib/agent/b9Console.test.ts` (matrix `B9-01` …
`B9-06`) lock these guarantees offline.

## Gates (all additive)

- `AGENT_RUNTIME_ENABLED` is the **only** B9 gate. It is checked before any
  workspace read, defaults off, and is hard-off when `NODE_ENV` or `VERCEL_ENV`
  is `production`. No new flag was introduced.
- The draft/WA pipeline is untouched: no change to `lib/conversations.ts`,
  `lib/aiEmployees.ts`, `lib/ai/*Provider*.ts`, `lib/outbound/*`, `lib/whatsapp*`,
  `app/api/whatsapp*` or any of their tests.
- No migration, table, dependency or lockfile change. The tracked migration
  count stays at 34.
- No provider, WhatsApp, calendar, browser-binary, hosted-DB or network call.
  `WHATSAPP_OUTBOUND_ENABLED` stays `false`.

## Verification before push

```bash
npm run check
npm run eval:agent
npm run check:agent-matrix
git diff --name-only   # must not list any F1 pipeline file
```

## Owner actions that remain

- The owner merges the PR. The operator never merges, closes or updates `main`.
- Cutover is a separate owner decision: nobody flips `AGENT_RUNTIME_ENABLED`
  under this instrument.
- Stage F resolution and Meta verification remain external owner gates; B9 does
  not claim either is complete.
