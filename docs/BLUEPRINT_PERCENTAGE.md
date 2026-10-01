# Nexa Full Blueprint — Percentage Status

**Status date:** 2026-09-30  
**Purpose:** Live-state readiness snapshot for Nexa. This document records what is actually implemented/validated versus what remains blocked by credentials, provider setup, deployment plumbing, or production operations.

## A. Overall Readiness

| Track | Complete | Incomplete |
|---|---:|---:|
| Code (features built, CI-green, 662 tests) | 94% | 6% |
| Production live (nexa-skld, health ready @ 3c10dca) | 100% | 0% |
| Auth (signup/login/session) | 100% | 0% |
| Database + RLS + migrations | 87% | 13% |
| Calendar OAuth (staging-only flow) | code 100% / live 10% | gate-on modelled, consent pending |
| Appointment booking (ledger + adapter, sandbox-proven) | code 100% / staging 100% | real provider 0% |
| Real AI (OpenAI) | 10% | 90% |
| WhatsApp inbound/outbound | 0% | 100% |
| Monitoring/backup/ops drill | 20% | 80% |
| Global readiness | 55% | 45% |
| India readiness | 65% | 35% |

## B. Live Validation (what's actually working)

| Item | % | Blocked by |
|---|---:|---|
| Production deploy visible + /api/health 200 | 100% | — |
| Signup + login on production | 100% | — |
| Prod Google OAuth gate OFF (verified 404) | 100% | by design, owner |
| Staging gate ON → /connect returns 401 (auth enforced) | 100% | — |
| Staging calendar_oauth_connections table applied | 100% | — |
| Real OAuth consent → encrypted token row | 0% | active preview host callback not Google-registered + owner consent + token escrow |
| Booking ledger on staging + live adapter | 100% (2/2 PASS, sandbox) | — |
| Real Google calendar event / outbound | 0% | owner, no outbound |
| Real AI draft (OpenAI) | 0% | $5 credit (owner) |
| Real WhatsApp message / send | 0% | Meta WABA (owner) |
| Backup + restore drill | 0% | DB admin creds |
| Knowledge v0 live | 0% | migration gate + owner flag |

## C. Deployment Plumbing

| Item | % | Note |
|---|---:|---|
| Primary prod (nexa) build+deploy | 100% | every commit lands |
| Secondary prod builds (nexa-staging, nexa-8rk5) | 0% | failing; logs unreadable (Vercel token 403) |
| Preview builds (all 3 projects) | 100% | green today |

## D. One-Number Answer

- **Code complete:** 94%
- **App live & usable:** 100% (closed beta)
- **Staging calendar-OAuth:** code 100% · gate/auth 100% · real connection 0%
- **Real AI:** 10%
- **WhatsApp:** 0%
- **Global go-live:** 55%
- **India go-live:** 65%
- **Owner-credentials ceiling:** ~55% global / ~65% India
  - OpenAI $5 → 75%
  - +WABA → 85/92%
  - +SMTP → 90/95%

## E. Today (2026-09-30)

- ✅ prod live/gate-off
- ✅ staging OAuth schema + gate-on
- ✅ booking ledger proven (2/2)
- ⛔ WhatsApp / real-AI / outbound
- ⚠ secondary prod builds failing

## Interpretation

The percentage figures above are **readiness indicators, not independent test results**. A percentage marked as complete should be read in the context of the validation evidence and blockers in the same table. Provider credentials, consent, production callback registration, outbound permissions, and operational drills remain separate gates from code completion.
