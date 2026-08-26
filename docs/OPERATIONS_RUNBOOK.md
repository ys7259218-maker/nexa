# Nexa operations runbook

This runbook covers safe preview and production operations. It does not authorize a deployment, migration, provider change, or outbound message. The public `GET /api/health` endpoint is a shallow application-process readiness check only. A `200` response with `{"status":"ready"}` means the web process can serve requests; it does not prove that Supabase, WhatsApp, OpenAI, migrations, backups, or outbound delivery are ready.

## Release gates

Before requesting release approval:

1. Confirm CI passes the locked install, dependency audit, lint, typecheck, unit tests, and production build.
2. Review the diff for secrets, customer data, unsafe logging, migrations, feature-flag changes, and unexpected lockfile changes.
3. Obtain CIPHER security/release review and NEXA PRIME approval.
4. Confirm required migrations were separately approved, backed up, applied, and verified by ASTRA before enabling their feature flags.
5. Keep outbound WhatsApp and other external side effects disabled until their dedicated readiness evidence is approved.
6. Record the approved commit, target environment, current stable deployment, flag state, operator, and rollback owner.

## Smoke test

Use synthetic data only. Stop if any check fails.

Before deploying a closed-beta Preview, load its environment variables without printing them and run:

```bash
npm run preflight:preview
```

The preflight requires configured browser-safe Supabase values, `AI_PROVIDER=mock`, and every rollout/outbound flag explicitly set to `false`. It validates names and relationships only; it never prints values and does not replace migration or RLS evidence.

1. Open the deployment root and confirm a normal page response over HTTPS.
2. Request `GET /api/health` and require status `200`, exact JSON `{"status":"ready"}`, and a `Cache-Control` value containing `no-store`.
3. Request `HEAD /api/health` and require status `200` with an empty body.
4. Exercise login/logout and one authorized read-only page with a dedicated test account. Confirm an unauthenticated session cannot open protected workspace data.
5. Confirm paused/draft employees and workspace kill switches remain fail-closed. Do not send a real WhatsApp message as a smoke test.
6. Check deployment logs for new server errors without copying tokens, payloads, phone numbers, message bodies, or customer records into the incident channel.

The public portion of steps 1–3 plus the unauthenticated dashboard redirect can be repeated without credentials:

```bash
npm run smoke:deployment -- https://your-preview-host.example
```

Run the authenticated checks manually with a synthetic account. Never pass credentials in the command URL or arguments.

## Rollback

Prefer the smallest reversible action:

1. Pause automation and disable newly enabled feature flags first. Preserve inbound records and audit history.
2. Route traffic back to the recorded stable deployment using the hosting platform's approved rollback mechanism.
3. Repeat the health and read-only smoke checks against the restored deployment.
4. Do not reverse or edit database migrations from this runbook. Coordinate database recovery with ASTRA using the migration-specific rollback evidence and verified backup.
5. Record the failed and restored deployment identifiers, flag changes, timestamps, symptoms, and approvers. Never record secrets or customer content.

## Incident response

1. **Triage:** identify impact, start time, affected surface, and whether data confidentiality/integrity or outbound actions are involved.
2. **Contain:** pause automation, disable the affected integration or feature flag, revoke exposed credentials through the provider if necessary, and restrict access. Do not paste the credential into tickets or chat.
3. **Coordinate:** NEXA PRIME owns incident command; CIPHER owns security assessment; ORBIT owns service recovery; ASTRA owns database recovery; RELAY owns provider containment.
4. **Recover:** roll back to the last verified deployment, validate health and authorization, then restore capabilities gradually with approval.
5. **Close:** document a privacy-safe timeline, root cause, customer impact, evidence, corrective actions, owners, and due dates. Rotate any potentially exposed secret and verify audit/backup integrity.

Severity guidance: **SEV-1** for active data exposure, cross-workspace access, uncontrolled outbound actions, or broad outage; **SEV-2** for major degraded functionality without confirmed exposure; **SEV-3** for limited or low-impact degradation. Escalate uncertain exposure as SEV-1 until CIPHER confirms otherwise.

## Monitoring boundaries and rollout blockers

The health endpoint must remain free of environment names, versions, commit identifiers, dependency results, provider names, configuration state, error messages, and timings. Deeper dependency checks belong in authenticated monitoring with privacy-safe aggregation.

Production readiness remains blocked until the owner verifies hosting access/protection, auth callback URLs, required migrations and RLS evidence, external-provider readiness, monitoring and alert routing, a backup restore drill, a preview smoke test, and a tested platform rollback. CI and this runbook provide gates and procedures; they do not satisfy those external checks by themselves.
