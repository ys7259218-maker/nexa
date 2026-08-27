# Nexa development operating model

Status: single-controller model active from 27 August 2026.

The earlier NEXA PRIME CEO plus ASTRA, NOVA, CIPHER, RELAY, FORGE, and ORBIT agent team is retired and must not be started. Those names remain historical only; they have no authority, background tasks, production access, or active work allocation.

## Active command structure

```text
Human Project Owner
        │
Codex — sole controller, reviewer, integrator, and release gate
        │
Approved external helper tools (Kimi, OpenCode, and explicitly approved apps)
```

Codex owns architecture, priorities, code review, security review, tests, commits, and GitHub integration. External tools are bounded helpers, not autonomous team members.

## External-helper rules

- Helpers work only on a named, secret-free packet in an isolated branch or worktree.
- Private source is shared with a provider only after the Human Owner explicitly approves that provider and payload class.
- Helpers never receive `.env` files, secrets, customer data, OTPs, production credentials, billing authority, or unrestricted account access.
- Helpers never push directly to `main`, deploy, apply migrations, change production data, enable paid providers, or send outbound messages.
- Generated output is untrusted until Codex inspects the diff and runs the required gates.
- If a helper is unavailable, rate-limited, reconnecting, or produces unsafe work, Codex stops that packet and continues locally.

## Standard task lifecycle

```text
Human objective
  → Codex selects one bounded slice
  → optional approved helper implementation or review
  → Codex diff/security review
  → fixes and focused tests
  → lint + typecheck + unit + build + audit + secret/diff gates
  → Codex scoped commit and GitHub push
  → separately approved preview/production operations
  → honest progress report
```

## Non-negotiable rules

- The existing GitHub repository remains the single source of truth; Nexa is never rebuilt elsewhere.
- Safe defaults and database/server authorization override UI behavior.
- No production database change, deployment, provider change, payment, outbound message, or destructive operation is implied by a code commit.
- Database migrations are additive, reviewed, rollout-gated, backed up, and tested with two synthetic accounts before enablement.
- Every material feature needs honest states, bounded validation, authorization, tests, auditability, rollback, and documented limitations.
- Meta WhatsApp registration remains an external blocker; outbound stays disabled.

## Current responsibility map

| Area | Controller | Optional bounded helper | Release gate |
| --- | --- | --- | --- |
| Next.js product and UI | Codex | Kimi/OpenCode | Honest states, accessibility, full checks |
| Supabase schema and RLS | Codex | OpenCode read-only review after approval | Migration-chain tests plus live two-account proof |
| Security and QA | Codex | Approved second-opinion review | No unresolved blocking finding |
| GitHub and documentation | Codex | OpenCode mechanical help | Clean diff, no secrets, green commit |
| Vercel and production | Codex with Human Owner | None by default | Explicit operational approval and rollback evidence |
| Meta/external providers | Codex with Human Owner | None by default | Account verification and controlled test gates |

This model reduces overlapping-agent risk while still using approved AI applications for high-volume bounded work.
