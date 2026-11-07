# DEXYBOR AI — MERGE & HARDEN: WHATSAPP & CUSTOMER-SAFETY REGRESSION

**Report ID:** MH-G-W (Stage G) · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · HEAD `8c70be6` · mode: read-only + safe local tests only

---

## 1. Bottom line

**Customer-safety protections are intact and unchanged.** No WhatsApp code, configuration, env value, or Meta setting was touched during this operation; no outbound message was sent; `WHATSAPP_OUTBOUND_ENABLED` remains `false` (default, example, and test expectations agree). Every WhatsApp protection observable at unit level passed fresh, twice today (dedicated subset + the full 667-test suite that includes them).

## 2. Feature-flag confirmation (fresh evidence)

| Check | Evidence | Result |
|---|---|---|
| Example config default | `.env.example` line 31: `WHATSAPP_OUTBOUND_ENABLED=false` | FALSE |
| Local runtime env | no `.env` file exists in the worktree (untracked set has none) ⇒ runtime default falsy | FALSE |
| Sender gating | `lib/outbound/whatsappSender.ts` requires `enabled = env.WHATSAPP_OUTBOUND_ENABLED === "true"` **and** non-empty token **and** phone-number-id (triple gate); locally both secret values are absent | FAIL-CLOSED |
| Preflight guard | `lib/deployPreflight.ts` lists the flag; fresh test `approval alone does not weaken WHATSAPP_OUTBOUND_ENABLED=false` passes | FALSE preserved |
| UI honesty | `components/ai/WhatsAppSetup.tsx` text matches disabled state | intact |
| Handoff docs | `NEXA_HANDOFF.md` / `OPENCODE_HANDOFF.md` state `AI_PROVIDER=mock`, outbound flags all false | unchanged |

No test, command, or person set the flag truthy. Meta webhook configuration untouched. No real messages/calls attempted (also none possible: transport dead without token/flag).

## 3. Pipeline protection matrix (unit-tested, fresh PASS)

| Prompt requirement | Code/test evidence (names condensed from fresh run) |
|---|---|
| Meta webhook verification | `lib/whatsapp.test.ts`: accepts valid `x-hub-signature-256`; rejects missing/malformed/mismatched |
| Inbound event ingestion | `lib/whatsappIngest.test.ts`: "fresh message events flow through channel, conversation, messages, and ledger" |
| Duplicate-event protection | "replaying an event id is deduplicated without touching conversations"; receipts "duplicate receipts deduplicate" |
| Channel assignment | "selects the exact active employee instead of the oldest employee"; reassignment scoped & authoritative; unassigned ⇒ store-only, never draft |
| Message persistence | inbound rows stored even for kill-switch/opt-out/human-takeover scenarios |
| AI draft generation | Knowledge-v0 deterministic draft; bounded prior-turn memory; draft status `draft_blocked`, never `sent` |
| Owner approval | "sendApprovedDraft fails closed when the message is missing / hides other users' messages / rejects not-a-pending-draft" |
| Outbound feature flag | "parseOutboundConfig fails closed without flag, token, or phone id"; template send "returns not_ready without fetching when gated off" |
| Atomic message claiming | "claims atomically: one concurrent approval wins one transport call"; second claimant → `already_claimed`, no transport |
| Idempotency | "a previously stored message id is treated as success without a second reply"; claim token matching for finalize/release |
| Retry behavior | sender classifies transient (5xx/429/Meta codes), retries transient only; "keeps the claim on an ambiguous transport error (no silent auto-resend)" |
| Delivery receipts | "delivery receipts update only the owner's matching outbound message"; progression never regresses read |
| 24-hour window | sessionWindow suite: free-form inside window; forces template exactly at/past window; stale/future inbound rejected; failure closed when window unverifiable |
| Opt-out handling | "customer opt-out is honored even when the conversation-safety flag is disabled"; "refuses to contact opted-out customers" |
| Error handling | ledger failure marks failed and retries recover; persistence failures surface `persist_failed`; DB claim denials map to honest outcomes |

## 4. Fresh test runs (2026-11-07)

| Run | Scope | Result |
|---|---|---|
| WhatsApp subset: `node --test lib/whatsapp.test.ts lib/whatsappEvents.test.ts lib/whatsappChannels.test.ts lib/whatsappIngest.test.ts lib/outbound/whatsappSender.test.ts lib/outbound/sessionWindow.test.ts lib/outbound/validation.test.ts` | dedicated | exit 0 — fail 0 |
| Full `npm test` (includes all of the above files) | 667 tests | 667 pass / 0 fail (see MH-H) |
| `lib/deployPreflight.test.ts` (flag invariants) | included above | all pass |

## 5. Blocked / not-run classifications

| Item | Class | Reason |
|---|---|---|
| Live Meta webhook verify round-trip | BLOCKED | requires external Meta app + signature secret infra; no external calls permitted |
| Outbound finalizer staging proof (#222 CI harness) | BLOCKED | needs disposable-DB authorization (OD-02 OPEN); harness itself not shipped to HEAD by this op |
| Booking staging replay (#221 harness) | BLOCKED | same OD-02 reason; provider-side commit not integrated yet |
| Any send/retry smoke against real number | BLOCKED | forbidden by §1; never attempted |

## 6. Regression assessment

No reconciliation was performed and no WhatsApp file differs from its session-start state (hash match in MH-C §2–3 includes the WhatsApp-adjacent preflight files). Therefore no new regression surface exists. The fresh passing suites prove the protected behaviors at commit-time code level.

**Conclusion:** WhatsApp pipeline protected; outbound disabled; would remain so after the proposed integration (integration plan explicitly protects the pipeline).
