## Pending appointment review inbox read — staging-only, unmerged (2026-09-24)

- Branch `codex/appointment-review-inbox-read-v1` adds a gated, authenticated `GET /api/appointment-reviews?workspaceId=<uuid>` and RLS-scoped, role-checked `listPendingAppointmentReviews` query; capped at 30 newest pending records. Reader requires owner/admin/operator, rejects cross-workspace rows, and returns `booked:false`. No approval mutation, real appointment booking, customer send, or staging flag activation. Seven contract tests added (expected **592** unit tests; CI pending). Adds a separate staging-only SSR read-only `/appointment-reviews` inbox page gated by authenticated session and current workspace, without approval/booking controls.

## Staging appointment review origin hardening — unmerged (2026-09-24)

- `codex/appointment-review-origin-guard-v1` blocks missing, malformed, cross-origin and non-HTTPS browser write requests before session/DB access; authentication, RLS, opt-in staging project and Vercel production veto remain independent checks. Four unit tests, expected **585** total, CI pending. This is a code-only review; no runtime flag, customer send, booking, migration or production change.

## Additional appointment review staging guard (2026-09-24)

- `codex/appointment-review-vercel-production-gate-v1` blocks appointment-review writes whenever `VERCEL_ENV=production`, even if the staging Supabase URL and opt-in flag are accidentally copied to production. Two new tests; expected **581** unit tests, pending CI. Staging SQL viewer-role proof passed in a rolled-back non-personal workspace transaction; see `docs/APPOINTMENT_REVIEW_STAGING_PROOF.md`. No endpoint flag enabled, real booking, customer send or production migration.

## Staging-only appointment review API route — disabled by default (2026-09-24)

- `codex/appointment-review-staging-route-v1` adds a gated authenticated `POST /api/appointment-reviews` endpoint and four tests (**579** expected; CI pending). Gate requires both explicit `APPOINTMENT_REVIEW_STAGING_ENABLED=true` and the exact staging-test Supabase URL. Flag has not been enabled; no live HTTP request, production action, real booking, or outbound customer send has been executed.

## Appointment review queue — staging-only database proof (2026-09-24)

- Supabase staging-test (`vbizuxxgjlwqotuegskq`) now contains the `appointment_review_requests` table from staging-only migration version `20260924172517`. Synthetic two-workspace RLS/idempotency tests passed and rolled back with zero test records; details: `docs/APPOINTMENT_REVIEW_STAGING_PROOF.md`. Production remains unchanged at 24 canonical migrations. **Do not apply staging's experimental migration to production** or claim booking is implemented; reconcile its differing migration history and review a canonical migration first. This branch expects **575** unit tests; CI pending.

## Pending appointment queue schema proposal — not deployed (2026-09-24)

- `codex/appointment-review-schema-contract-v1` adds a proposed SQL contract and two static tests (**575** expected, CI pending). SQL remains under `docs/`, not the canonical migration chain, and has not been applied to staging/production; the live queue is still unavailable.

## Appointment write-boundary hardening — not released (2026-09-24)

- `codex/appointment-adapter-write-auth-v1` adds independent write-side actor/inbound ownership checks and two tests. **573** tests expected, pending CI; no migration applied or real booking performed.

## Proposed Supabase appointment review adapter — NOT deployed (2026-09-24)

- The `codex/appointment-supabase-adapter-v1` branch expects **571** unit tests, pending CI. Staging is healthy but no `appointment_review_requests` table or migration has been applied. The adapter is not wired to any route and cannot save requests in the current database; no booking or outbound send exists.

## Stacked appointment-review workflow branch — not released (2026-09-24)

- `codex/appointment-review-workflow-v1` expects **565** unit tests after adding six fail-closed orchestration tests. CI verification pending. This branch supplies a repository contract and orchestrator only; it does **not** implement database persistence or bookings and is not merged or deployed as a release.

## Proposed action-boundary branch — not released (2026-09-24)

- `codex/action-proposal-boundary-v1` registers five additional safety checks: **559** unit tests expected on the branch, pending GitHub CI verification. The 554-test closed-beta production checkpoint below remains the verified `main` result. This branch does not book appointments, send messages, or activate AI.

# Nexa — Go-Live Runbook (Free-Tier First)

> **Verified closed-beta production checkpoint (2026-09-22):**
> - `main` includes the production-readiness reconciliation from PR #193; its exact reviewed head passed the repository gates with **554** unit tests, GitHub CI, all PR Vercel checks, and zero audit vulnerabilities.
> - The dedicated production Supabase project `nkxhlugrprdtqyqcahfx` has all canonical migrations applied **24/24**; production RLS integration passed **14/14** and synthetic issue-report residue is zero. The newest migration is now `20260919120000_audit_entity_type_constraint_normalization_v1.sql` (24 migrations in the chain; was `20260912191715_database_privilege_hardening_v1.sql`).
> - The canonical production aliases `nexa-skld.vercel.app` and `nexa-beryl-gamma.vercel.app` resolve to a READY deployment of the reviewed `main`; health and public safe-route smoke passed with no runtime errors in the verification window. The immediately preceding healthy Git-integrated production deployment remains the rollback target.
> - The production backup completed a full local Postgres 17 restore drill with migration, selected-row, auth-user, table, policy, RLS, and trigger parity. The recovery bundle was checksummed, encrypted with an owner-held passphrase, decrypt-tested, verified again, and placed off-device without uploading plaintext. See `docs/RECOVERY_RUNBOOK.md`.
> - The production-build guard remains enforced. `AI_PROVIDER=mock`, `WHATSAPP_OUTBOUND_ENABLED=false`, and every rollout/beta/outbound flag remain fail-closed. Real AI and WhatsApp activation are optional owner-gated phases, not missing closed-beta release gates.
## Owner go-live approval — 2026-09-14

The owner gave full go-live approval intent on 2026-09-14. **This record is not itself
release approval or production-readiness evidence.** It creates no provider state, does
not satisfy the production-readiness guard, and does not substitute for the owner-gated
provider actions below. Until those complete, a Vercel production build still fails
closed at `next.config.ts`.

Completed production-readiness actions:

1. **Provisioned** the dedicated production Supabase project `nkxhlugrprdtqyqcahfx`; the guard still rejects the staging project as a production target.
2. **Set and verified** the production build signal and fail-closed values without exposing secret values.
3. **Apply the 24 canonical migrations** in order and run `npm run test:integration`: complete, 14/14.
4. **Executed and recorded** the backup/restore drill plus encrypted off-device recovery verification.
5. **Deployed, smoked, and promoted** the reviewed candidate while retaining a healthy rollback deployment.

Remaining optional owner-gated phases are real OpenAI enablement, Meta WhatsApp registration/outbound testing, SMTP/custom email delivery, and any paid-plan or destructive recovery decision.

> Decision (2026-09-06): **stay on free plans.** No paid plan is required to run the
> app. This runbook gets a real deployment live on Vercel Hobby + Supabase Free, and
> flags the exact points where a paid step *may* be needed later (and what not to
> buy until then).
>
> Repo state: `main` @ `cf70cdc`, 310+ unit tests green, CI green, deploy proven.

---

## 0. Accounts you already need (all free)
- GitHub (repo owner) — done
- Vercel (Hobby) — done (deploys already green)
- Supabase Free project — **not created yet**
- Meta Developer app + WhatsApp Business profile — **not created yet**
- OpenAI — **only when AI replies go live** (not now)
- Sentry (free tier) — optional now

---

## 1. Supabase Free — database + RLS

1. Create a free project. Note: **free tier auto-pauses a project after 7 days of no
   activity**; hit the dashboard or an endpoint weekly or expect a cold start.
2. Apply migrations **in the exact filename order** of `supabase/migrations/`
   (newest file = `20260905120000_outbound_sent_status.sql`). Two options:
   - **supabase CLI**: `supabase link --project-ref <ref> && supabase db push`, or
   - paste each `.sql` file into the SQL Editor in order.
3. Enable RLS — all migration files already `enable row level security`; do not skip.
4. Copy these into the project env (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, WhatsApp processor + outbound)
5. Verify RLS with the repo's integration test:
   `npm run test:integration` (`tests/integration/rlsCrud.test.ts`).

## 2. Vercel Hobby — app hosting

1. Import the repo, set the **same env vars** from step 1. Checkbox: "Production + preview".
2. Deploy. Expected Hobby quirks (not failures):
   - **Deployment rate-limit** when too many deploys in a short window → next deploy
     retries in ~24h. This is why we merge rarely and batched.
   - Build minutes are capped; keep big builds infrequent.
3. Pre-flight + smoke that gate merges are wired into CI already; local equivalents:
   `npm run preflight:preview` and (after a prod deploy) `npm run smoke:deployment`.

## 3. Meta WhatsApp — inbound (free)

1. Create a Meta developer app → add the **WhatsApp** product → get your WABA +
   a phone number + a test/registered number.
2. Webhook config:
   - URL: `https://<your-app>.vercel.app/api/whatsapp/webhook`
   - Verify token: your `WHATSAPP_VERIFY_TOKEN` (random high-entropy string)
   - Subscribe to fields: `messages` and `message_template_status_update` (optional).
3. Env: `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` (system user token),
   `WHATSAPP_PHONE_NUMBER_ID`, keep `WA_MESSAGE_RETRY_SECRET` empty unless you want
   the internal retry endpoint.
4. Verify inbound: use Meta's sandbox "send message" to your phone → message appears
   in `/conversations` as a stored inbound row. **No paid step.**

## 4. AI replies — free vs paid (the honest part)

- Current: `AI_PROVIDER=mock` → drafts from mock provider. **Free.**
- To get **real drafts**: set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
  - → **This is where a paid OpenAI credit is required** (no free tier; ~$5 minimum,
    `gpt-4o-mini` is cheap). **Do not buy until you want real AI drafting.**
- Safety: `npm run eval:ai:safety` runs offline safety evals before trusting drafts.

## 5. Outbound — human-approved sends (mostly free)

1. Set `WHATSAPP_OUTBOUND_ENABLED=true` + outbound env (access token, phone id).
   Drafts in `/conversations` get the **Approve & send** button.
2. Meta billing on the Cloud API:
   - **Within the 24h customer-service window → free-form sends are FREE.**
   - **Out of window / template / marketing → per-message charge.** Do not enable
     template sends until you accept that cost (see Paid triggers).
3. Controlled test: approve one draft against a number you own inside the 24h
   window, watch `messages.status` become `sent`, then `delivered`/`read`.
4. We already enforce: ownership, E.164, opt-out, human-takeover, and the 24h window
   (fail-closed) in `lib/server/draftSender.ts` — nothing else needed.

## 6. Monitoring (free tier)

- `NEXT_PUBLIC_SENTRY_DSN` → Sentry free tier (~5k errors/month). Optional, set when
  you want error visibility.
- Audit/issue-report/team features: enable each flag **only after** the corresponding
  migration is applied and its dedicated RLS checks pass (each flag's meaning is
  documented in `.env.example`).

---

## 7. Free-tier gotchas (read before go-live)

| Gotcha | Consequence | Workaround |
|---|---|---|
| Supabase free project pauses after 7 days idle | App can't query until woken (SQL editor/`supabase db push` dropdown, or a weekly ping) | Weekly ping endpoint |
| Vercel Hobby deploy rate-limit | Some deploys wait ~24h | Batch merges (we already do) |
| OpenAI has **no** free tier | Real AI drafts need a paid credit | Keep `AI_PROVIDER=mock` until ready |
| WhatsApp template/marketing sends are billed | Small per-message cost | Free-form window sends only, until approved |
| Single-region (Vercel/Supabase) | Not multi-region "global" | Accept for MVP; re-tune at scale |

---

## 8. Paid triggers — when to tell the owner to buy

These are loud, explicit signals — do NOT buy anything until one of these actually
happens:

1. **Real AI drafting wanted** → OpenAI credit (~$5+). (Or keep mock forever.)
2. **WhatsApp out-of-window/template sends wanted** → accept per-message billing.
3. **Deploy rate-limit blocking work** → consider Vercel Pro (only if it hurts).

> Owner's standing instruction: when a paid step genuinely becomes necessary, flag it
> clearly first. Free-tier operation continues until that explicit signal.

---

## 9. Pre-go-live checklist (what being "ready" means)

- [x] Supabase production project created, all migrations in `supabase/migrations/` applied in order
- [x] `npm run test:integration` (RLS) passed 14/14 against production
- [x] Vercel production environment guarded, candidate smoke passed, and production deploy is green
- [x] Backup restored locally, checksums verified, and encrypted off-device recovery copy decrypt-tested
- [ ] Meta WhatsApp: webhook verified, inbound appears in `/conversations`
- [ ] (Optional real drafts) OpenAI set + offline safety evals pass
- [ ] Outbound enabled only during a controlled known-number test; status `sent`→`delivered` confirmed
- [ ] Sentry DSN set (free) + one manual error check
- [ ] Free-tier gotcha notes handed to whoever operates the account
