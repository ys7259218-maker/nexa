# Nexa disaster recovery and new-PC runbook

This runbook makes Nexa recoverable without the old computer. It separates code, hosted configuration, production data, and account credentials so that losing Windows or the device does not become a single point of failure.

Never commit or sync a plaintext database backup. Never put a password, token, database URL, recovery code, or encryption key in Git, chat, command arguments, logs, screenshots, or this runbook.

## Recovery inventory

Keep these layers independent:

1. **Code and documentation:** the private/public GitHub repository, including all migrations and this runbook.
2. **Production hosting:** the Vercel project and its environment-scoped variables. Secret values stay in Vercel; record only variable names in documentation.
3. **Production database:** a checksummed Supabase backup that has passed a full local restore drill, encrypted before it leaves the trusted local machine.
4. **Account recovery:** GitHub, Vercel, Supabase, domain registrar, OpenAI, and WhatsApp recovery codes and MFA recovery methods stored in an owner-controlled password manager, not in the repository.
5. **Recovery key:** the private key or passphrase for the encrypted database archive. Store it separately from the archive and keep at least one offline copy.

The production Supabase project reference is `nkxhlugrprdtqyqcahfx`. The staging project reference is `vbizuxxgjlwqotuegskq`; never restore production data into staging and never point production at staging.

## Before placing a backup off-device

1. Require a completed local restore drill. `RESTORE_VERIFIED.txt` must report the expected migration, table, policy, RLS, row-count, auth-user, and trigger checks.
2. Run the verifier without opening or printing SQL contents:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verifyRecoveryBundle.ps1 -BundleDirectory C:\path\to\backup-v3-YYYYMMDD-HHMMSS
   ```

3. Encrypt the entire verified directory with either an owner-held public key or an interactively entered strong passphrase. Do not put the passphrase on the command line. Enable archive-header encryption so filenames are not visible.
4. Verify the encrypted archive can be decrypted into a throwaway local directory and that this verifier passes there too.
5. Upload only the encrypted archive to two independent owner-controlled locations. One may be cloud storage; the other should be offline or in a different provider/account.
6. Confirm the plaintext directory remains only on an approved encrypted local disk. Remove it only after the encrypted copies and a decryption drill are verified and the owner explicitly approves deletion.

## New Windows PC recovery

1. Secure the new PC first: install updates, enable BitLocker/device encryption, use a non-admin daily account, and enable screen lock.
2. Install Git, Node.js matching `package.json`, Docker Desktop, and the repository's locked dependencies. Install Vercel and Supabase CLIs only from their official sources.
3. Restore GitHub access through the owner's password manager and MFA recovery process. Clone the repository and check out the approved commit or tag. Do not copy an old `.env` file from an untrusted disk.
4. Sign in to Vercel and Supabase interactively. Re-link the existing projects; do not create replacement production projects unless the owner explicitly approves that recovery decision.
5. Download the encrypted recovery archive. Verify its outer checksum if one was recorded, decrypt it locally with an interactive prompt or private key, then run `scripts/verifyRecoveryBundle.ps1`.
6. Prepare an isolated local Supabase stack whose Postgres major version and Auth/Storage schema match the target platform. Restore schema, the single Nexa-owned `auth.users` trigger, non-empty data, and migration history. Require all checks in `RESTORE_VERIFIED.txt` to pass before any hosted restore.
7. For a hosted disaster recovery, create or select the approved target, confirm an additional backup exists, and have the authorized production operator perform the restore. Never overwrite a reachable production database without explicit owner approval.
8. Link Vercel to the existing project. Re-enter secret values from the password manager through provider-protected input; never paste them into source files or shell arguments.
9. Before deploying, require the production build guard: dedicated production Supabase URL, `PRODUCTION_RELEASE_APPROVED` exact approved value, `AI_PROVIDER=mock`, `WHATSAPP_OUTBOUND_ENABLED=false`, and every rollout/beta/outbound flag false.
10. Deploy a no-alias candidate, run health and safe-route smoke tests, inspect error logs, record the rollback deployment, and only then promote. Recheck every production alias after promotion.
11. Keep real AI and WhatsApp outbound disabled until their separate owner-approved activation and live testing ceremony.

## Minimum acceptance evidence

- Repository HEAD and `origin/main` match the approved full Git SHA; worktree is clean.
- GitHub CI is successful for that exact SHA.
- Backup and recovery manifests have zero checksum mismatches.
- Local restore verifies migration count, selected row counts, auth-user parity, public table/policy/RLS counts, and exactly one Nexa signup trigger.
- No plaintext backup exists in Git, OneDrive/Dropbox/Drive, tickets, chat, or build artifacts.
- Candidate deployment is READY; `/api/health` returns exact ready JSON with `no-store`; public safe routes load; recent error logs are clean.
- Rollback deployment identity and health are recorded before promotion.
- AI, WhatsApp outbound, and all rollout flags remain fail-closed until separately approved.

## Scheduled maintenance

- After every schema migration: take a new backup, perform a local restore drill, encrypt it, verify decryption, and rotate the off-device copy.
- Monthly: test repository clone, provider-account recovery, archive decryption, checksum verification, and local restore on a clean environment.
- Quarterly: review account owners, MFA recovery methods, least-privilege access, domains, billing contacts, retention, and the rollback procedure.
- After any credential exposure: treat it as an incident, rotate at the provider, invalidate old sessions, and create a fresh encrypted recovery bundle.

## Owner-only gates

Stop and request the owner for secure recovery-key/passphrase entry, destructive hosted restore, paid-plan change, domain/account ownership change, legal or financial commitment, or live AI/WhatsApp/outbound activation. All other checks should fail closed and preserve the last healthy deployment and verified backup.
