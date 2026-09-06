# Nexa — Go-Live Runbook (Free-Tier First)

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

- [ ] Supabase free project created, all 18 migrations applied in order
- [ ] `npm run test:integration` (RLS) passes against that project
- [ ] Vercel env = `.env.example` (+ real values), prod deploy green
- [ ] Meta WhatsApp: webhook verified, inbound appears in `/conversations`
- [ ] (Optional real drafts) OpenAI set + offline safety evals pass
- [ ] Outbound enabled only during a controlled known-number test; status `sent`→`delivered` confirmed
- [ ] Sentry DSN set (free) + one manual error check
- [ ] Free-tier gotcha notes handed to whoever operates the account