# Nexa accelerated execution board

Status: active closed-beta delivery plan

Coordinator: Codex (single controller)

Source of truth: this GitHub repository and its reviewed `main` branch

The 30-day target is a secure, honest closed beta—not a false claim that the entire global vision is finished. Meta phone registration remains an external track and does not block a safe web/test-mode beta. Real WhatsApp outbound stays disabled until its release gates pass.

## Working model

The previous CEO-plus-six-agent team is stopped. The names below are no longer active owners. Codex now controls every slice; Kimi/OpenCode may assist only with explicitly approved, secret-free packets.

| Active controller/helper | Scope | Responsibility |
| --- | --- | --- |
| Codex | Architecture, implementation, review, tests, merge, release decision | Keep one prioritized queue and reject unsafe or incomplete work |
| Kimi/OpenCode | Bounded implementation or second opinion on isolated worktrees | Return a reviewable diff; no secrets, production access, direct main push, or deployment |

## Non-negotiable controls

1. No agent or external AI receives production secrets, customer data, or unrestricted production access.
2. Each work packet uses its own branch or worktree. No agent pushes directly to `main`.
3. A packet names allowed files, forbidden actions, acceptance tests, and a rollback path before coding starts.
4. Generated code is untrusted until the diff is reviewed and all required gates pass.
5. Database migrations, deployments, provider changes, billing, and outbound messages require separate human-approved operational steps.
6. GitHub is the handoff boundary. Chat history is not the only record of decisions or progress.

## Critical path

### Gate 1 — isolated data proof (P0, 1–2 focused days)

- Package one ordered, replayable Supabase migration chain.
- Prove two-account isolation and the Owner/Admin/Operator/Viewer matrix.
- Record pre/post row counts, migration identifiers, policy checks, and a redacted evidence report.
- Complete a restore drill in an isolated target.

Acceptance: a fresh reset and second reset succeed; live integration tests prove tenant isolation and role boundaries; all feature flags remain false after testing.

### Gate 2 — preview delivery proof (P0, parallel with Gate 1)

- Use a Vercel Preview environment connected only to the dedicated test Supabase project.
- Run `npm run preflight:preview` inside the configured preview environment.
- Deploy an exact reviewed commit and run `npm run smoke:deployment -- https://preview-host`.
- Test login/logout and one authorized read with a synthetic account.
- Record the prior stable deployment and rehearse rollback.

Acceptance: preview cannot touch production data; public smoke checks pass; authenticated isolation is witnessed; rollback returns to the recorded stable deployment.

### Gate 3 — trustworthy closed-beta journey (P0, 5–8 working days in parallel)

- Remove or clearly label dead navigation and inert controls.
- Persist first-run setup after signup and allow safe resume.
- Add an employee test sandbox that never sends externally.
- Explicitly assign a channel to an employee, or enforce one employee per beta workspace.
- Correct copy that currently implies file ingestion, voice, calls, or deployment exists when it does not.

Acceptance: a new owner can sign up, configure one real employee, add business facts, test a clearly labeled draft, inspect inbox state, and pause safely without encountering a fake control or claim.

### Gate 4 — knowledge v0 and beta operations (P0, 5–8 working days)

- Provide structured, editable, deletable notes/FAQs used by the test/runtime context.
- Add privacy-safe monitoring, alert routing, usage caps, issue reporting, and deletion verification.
- Complete responsive and accessibility checks for the core journey.

Acceptance: missing facts cause an honest fallback/handoff; knowledge changes affect test results; the owner can stop the system; operators can detect and safely recover failures.

### Gate 5 — controlled beta release (2–4 working days)

- Codex performs the final tenant, auth, logging, flag, migration, dependency, and secret review; an approved external tool may provide a non-authoritative second opinion.
- Run lint, typecheck, all unit/integration tests, production build, dependency audit, secret scan, preview smoke, and rollback rehearsal.
- Invite only synthetic/internal testers first, then a small monitored cohort.

Acceptance: every release gate in `docs/NEXA_MASTER_BLUEPRINT.md` has linked evidence. Any missing gate keeps the release in test mode.

## First OpenCode work packet

Branch: `opencode/nova-honest-ui`

Purpose: remove misleading or inert UI without changing architecture or external systems.

Allowed work:

- Replace `href="#"` navigation with real routes or explicit disabled “Coming later” presentation.
- Remove, disable, or label dashboard actions that currently do nothing.
- Correct knowledge, voice, calls, appointments, analytics, and onboarding copy so it describes current capability honestly.
- Add focused UI tests where the repository pattern supports them.
- Update relevant documentation.

Forbidden work:

- No database migration, environment change, deployment, provider call, secret, outbound message, dependency upgrade, auth rewrite, or direct `main` push.
- Do not redesign the established Nexa visual identity.
- Do not claim that unavailable functionality works.

Acceptance:

- No reachable `href="#"` remains in the authenticated core journey.
- Every visible control either works, navigates correctly, or is clearly unavailable.
- `npm run check` and `npm audit --audit-level=high` pass.
- The final response includes changed files, test evidence, remaining limitations, and the branch commit; Codex reviews before merge.

## Usage and continuity strategy

- Use the strongest reasoning only for architecture, migrations, security, and merge decisions.
- Use lighter agents/tools for bounded UI cleanup, documentation, test generation, and mechanical checks.
- Keep packets small enough to review in one diff; do not run six heavy coding agents against overlapping files.
- If one AI service reaches a usage limit, stop starting work there, commit the safe branch state, and continue the next packet through OpenCode or another approved tool from this board.
- A different tool does not automatically mean separate usage: that depends on the provider/account configured in that tool. Never paste a private key merely to bypass a limit.

## Current blockers that require the account owner

- Create/access the dedicated Supabase test project and synthetic test accounts.
- Confirm isolated Vercel Preview environment settings and deployment protection.
- Test the alert destination and platform rollback controls.
- Complete Meta business/phone registration when Meta allows it.

These steps require signed-in account actions or OTP approval. Codex can guide and verify them but must not request that passwords, OTPs, or secrets be pasted into chat.
