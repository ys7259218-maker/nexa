# Phase A — WhatsApp Pipeline Regression Protection (Task A7)

**Audit date:** 2026-11-07 · **Mode:** static review + existing local test suites. No real WhatsApp message, no Meta configuration change, no production credentials use, no e2e online test.

## 1. Existing protections verified in code (fail-closed by construction)

| Protection | Where | How it fails closed |
| --- | --- | --- |
| Meta webhook signature verification | `lib/whatsapp.ts` | rejects missing/malformed/mismatched signatures (test contract) |
| Event ingestion + durable ledger | `lib/whatsappIngest.ts`, `lib/webhookLedger.ts` | unregistered channels skipped; replayed event ids dedupe; processing failures mark ledger failed + retryable |
| Channel-to-employee assignment | `lib/whatsappChannels.ts` | assignment explicit/audited; workspace-bound; unassigned channels store inbound but never draft; non-active employees never draft |
| Conversation safety states | `lib/conversationSafety.ts`, `lib/workspaceSafety.ts` | kill switch stores history without AI draft; human takeover keeps stores but blocks drafts; feature-flag unset/false fails closed |
| Exact-keyword durable opt-out | `lib/whatsappIngest.ts:493` (`mark_conversation_customer_opt_out` guarded RPC) | opt-out honored even when safety flag disabled; opt-out messages never draft and never retry-send (`:589`) |
| Draft approval path | `lib/pendingApprovals.ts`, `app/api/outbound/draft`, `lib/retryFailedSends.ts` | sender refuses non-pending drafts, other users' messages, opted-out customers, takeover states, invalid E.164 |
| Outbound atomic claiming | migration + `lib/outbound/whatsappSender.ts` | one approval wins one transport call; claim tokens finalize/release; ambiguous transport error keeps claim (no silent resend) |
| 24-hour messaging window | `lib/outbound/sessionWindow.ts` | free-form only inside window; template required outside; stale/unparsable inbound fails closed; future timestamps rejected |
| Outbound feature flag | `lib/outbound/whatsappSender.ts:74` (`WHATSAPP_OUTBOUND_ENABLED === "true"`) | config not ready ⇒ all sends `not_ready` **without calling Meta** (`sendTextMessage` returns before `fetch` — test-pinned) |
| Provider failure facts | `sendApprovedDraft` | persists bounded failure reason; queue surfaces it |
| Delivery receipts | `lib/whatsappEvents.ts`, ingest path | only owner's matching outbound updates; no regression of read→delivered; dedupe receipts |
| Monitoring safety | guards at API edges | `internalAuth` Bearer fail-closed; body-size bounds on retry/draft endpoints |
| Production flag-preservation | `lib/productionGuard.ts` + `next.config.ts` | even with a reviewed release signal, production builds must keep `WHATSAPP_OUTBOUND_ENABLED=false` |

## 2. Runtime configuration note (without reading secret values)

Per the Phase A boundaries, the values of `.env.local` were not read. The relevant runtime posture is evidenced by:

- The unit-level transport gate (`resolveOutboundTransportReady`) requires flag **and** token **and** phone id simultaneously (tests assert `not_ready` without any).
- `npm run check:production-build` → exit 0 ("passed, no values printed") asserts the documented safe/default-safe configuration set for this machine's builds.
- **No outbound, retries, or template sends were triggered.** No Meta-facing call exists in any Phase A step. The production pipeline's inbound/outbound flags are untouched.

## 3. Tests executed today (local, no external effect)

| Suite group | Command | Result |
| --- | --- | --- |
| Full unit base incl. every WhatsApp module above | `npm test` | **667 pass / 0 fail** (exit 0; verify run 11:07 UTC, dur 10s) |
| Focus: inbound pipeline, opt-out, takeover, channel assignment, kill switch, receipts | covered by `whatsappIngest.test.ts`, `whatsappEvents.test.ts`, `whatsappChannels.test.ts`, `whatsapp.test.ts` | all pass (subset of run above) |
| Focus: outbound flag, window, templates, approval claim, retry | `outbound/whatsappSender.test.ts`, `outbound/sessionWindow.test.ts`, `outbound/validation.test.ts`, `pendingApprovals.test.ts`, `retryFailedSends.test.ts`, `failedSends.test.ts` | all pass (subset) |
| Production-flag regression contract | `productionGuard.test.ts` | pass |

## 4. Tests NOT executed (and why)

| Suite | Reason not run |
| --- | --- |
| `test:integration` (`tests/integration/rlsCrud.test.ts`) | requires hosted/database credentials; Phase A forbids hosted access and DB execution |
| `test:integration:appointments` / `:booking-reconcile` / `:booking-ledger-run` / `:reconcile-history` | require staging Supabase credentials / disposable-DB authorization (D7-OD-02) — BLOCKED, owner-gated |
| `test:smoke` (Playwright browser smoke) | not required for flag/pipeline protection today; a fresh build exists but running a browser against real hosted services exceeds the Phase A boundary (deployed `nexa-skld.vercel.app` and staging belong to production/staging systems this audit must not touch) |

## 5. Regression observed

**None.** No WhatsApp-related test failed; no file in the WhatsApp path was modified by Phase A; lint/typecheck confirm the uncommitted working tree (including the calendar changes) did not break the pipeline's contracts.

## 6. Confirmation statement

**No external, customer-facing, or production-affecting action occurred in Phase A.** The inbound pipeline remains signature-verified and ledger-backed; outbound remains disabled by design at the flag layer; the approval/claim/window/opt-out/takeover machinery is unchanged and fully test-backed.
