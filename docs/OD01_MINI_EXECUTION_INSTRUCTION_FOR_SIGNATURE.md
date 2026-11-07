# OD-01 MINI EXECUTION INSTRUCTION — FOR OWNER SIGNATURE (RECOMMENDED-DEFAULTS EDITION)

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S
> This is the **separate, owner-issued execution instruction** required for Stage F (distinct from the mini authorization, which must be signed first). It enumerates the exact operations the operator may run, in order, and where the operator must stop. Signing adopts it **exactly as written**; exceptions only via the EXCEPT box.

**Instruction scope:** Stage F (Merge & Harden) only · **Phase B needs its own later instruction** (mini auth already defaults OD-B12/B1/B2 per companion document) · conflict with signed authorization ⇒ operator stops.

---

## 1. Authorized operation sequence (the ONLY allowed actions, in this order)

| Step | Operation | Boundaries |
|---|---|---|
| 1 | Preservation copy + SHA-256 manifest + re-verify | destination recorded in run log; nothing overwritten |
| 2 | Create branch `codex/merge-harden-integration` from `8c70be6` | no new worktree; no edits to existing branches |
| 3 | Commit the preserved working tree (+248/−44 tracked incl. 12 modified + untracked originals + docs) onto the integration branch | deletions prohibited; root strays left in place |
| 4 | Merge `origin/main` @ `3c10dca` (7 approved commits; `c2b2120` DEFERRED) | intent-preserving conflicts; sensitive files escalate; documented per conflict |
| 5 | Dependency floors (7 packages + restricted lockfile edits) | no `npm audit fix/--force`; no majors; fresh floors re-verified at execution; before/after `npm audit --json` recorded |
| 6 | Full verification matrix + fresh production build locally | all green required; any red ⇒ STOP, report, wait |
| 7 | Create PR `codex/merge-harden-integration` → `main` (title: "DEXYBOR Stage F — integration & hardening") | via GitHub API/website as auth permits; no direct push to any branch; **force-push prohibited unconditionally** |
| 8 | Report: hashes, suite results, build id, PR link, complete evidence pack | production untouched; WhatsApp outbound stays `false` |

**Stop conditions (mandatory):** verification failure · unexpected repo state · conflict with signed authorization · expiry (14 days from signature) · any scope beyond §1 ⇒ STOP + report + wait.

## 2. Phase B note (not authorized by this instruction)

Mini auth defaults recorded: OD-B12 = Phase B after Stage F · OD-B1 = zero-new-deps validator · OD-B2 = no embeddings now. Implementation still requires a **further explicit owner instruction** after Stage F completes (that will be the next single message it needs).

## 3. Exception box

```text
EXCEPTED ITEMS (blank = none): ______________________________
Details: ____________________________________________________
```

## 4. Binding tick

```text
[x]  I AUTHORIZE the operator to execute steps 1–8 exactly as written (with/without my Section-3 exceptions).
```

## S. Owner signature (owner must type these fields personally — operator will not)

```text
Full legal name (typed): yuvraj singh
Authority basis: Repository owner
Signature (type full name again): yuvraj singh
Date & time typed: 07/11/2026 — 23:55 — Timezone: PKT
*Operator intake rule: blank or non-owner-filled fields ⇒ instrument VOID ⇒ nothing runs.*

**Status: `MINI EXECUTION INSTRUCTION PREPARED — AWAITING OWNER TYPED SIGNATURE — STAGE F BLOCKED`**
