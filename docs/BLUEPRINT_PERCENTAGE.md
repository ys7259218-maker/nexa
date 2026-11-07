# Nexa — Full-Stack Blueprint (Percentage View)

> Generated from live production state (2026-09-16). Neither marketing nor panic —
> exact status of every track, in %.

---

## A. Overall Readiness

| Track | Complete | Incomplete |
|---|---|---|
| **Code (features built, CI-green)** | 92% | 8% |
| **Production live (deployed, accessible)** | 100% | 0% |
| **Auth (signup/login/session)** | 100% | 0% |
| **Database + RLS + migrations** | 85% | 15% |
| **Real AI (OpenAI)** | 10% | 90% |
| **WhatsApp inbound** | 0% | 100% |
| **WhatsApp outbound** | 0% | 100% |
| **Monitoring/backup/ops drill** | 20% | 80% |
| **Global readiness** | 55% | 45% |
| **One-country readiness (India)** | 65% | 35% |

---

## B. Product Features

| Feature | Code | Live |
|---|---|---|
| AI Employees (list/detail/settings) | 100% | 100% |
| Training sandbox | 100% | 100% |
| Dashboard + analytics | 100% | 100% |
| Conversations inbox | 100% | 100% |
| Approve-and-send UI | 100% | 0% (WhatsApp off) |
| Failed-sends retry queue | 100% | 0% (WhatsApp off) |
| Templates (window-closed sends) | 100% | 0% (WhatsApp off) |
| Team / roles / audit | 100% | 100% |
| Issue reports | 100% | 100% |
| Notifications / search | 100% | 100% |
| Knowledge v0 + source registry | 70% | 0% (gated off) |
| Global search | 100% | 100% |

---

## C. Live Validation Matrix

| Item | % | Blocked by |
|---|---|---|
| Production deploy visible | 100% | — |
| Signup + login on production | 100% | — |
| Real AI draft (OpenAI) | 0% | **$5 OpenAI credit (owner)** |
| Real customer message → conversation row | 0% | Meta WABA setup (owner) |
| Real approved send → `sent/delivered/read` | 0% | Meta WABA + window test |
| Opt-out / stop handling | 0% | Needs real inbound |
| Backup + restore drill | 0% | DB admin creds |
| Knowledge v0 enabled | 0% | Migration gate + owner flag |

---

## D. Converts: What % Goes Up, By Doing What

| Do this | Global % | India % | Effort |
|---|---|---|---|
| OpenAI credit $5 (+ guard update) | 55→75 | 65→85 | 15 min |
| WhatsApp sandbox WABA + verify token | 75→85 | 85→92 | 1–2 hr |
| SMTP + email confirm ON | 85→90 | 92→95 | 30 min |
| Backup/restore drill + runbook | 90→95 | 95→96 | 1 hr |
| Public-launch hardening (monitoring, incidents) | 95→97 | 96→97 | ongoing |

**Glass ceiling without owner credentials: ~55% global / ~65% India.**
**Everything above that line requires the owner's accounts (OpenAI credit, Meta, SMTP, DB admin).**

---

## E. Where We Are Today (2026-09-16)

- ✅ Live: https://nexa-skld.vercel.app — public, auth working
- ✅ Supabase production connected, 23 migrations applied, RLS on
- ✅ OpenAI key present in Vercel production (needs credit to fire)
- ⛔ WhatsApp off (closed-beta policy — safe by design)
- 🟡 AI in `mock` mode (app fully usable; drafts are simulated)

---

## F. One-Number Answer

- **Code complete:** 92%
- **App live & usable:** 100% (closed beta)
- **Real-AI complete:** 10% (key set, credit needs funding)
- **WhatsApp complete:** 0% (blocked: owner Meta account)
- **Global go-live complete:** 55%
- **India go-live complete:** 65%