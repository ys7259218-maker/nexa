# DEXYBOR AI — MERGE & HARDEN: WORK PRESERVATION

**Report ID:** MH-C · **Stage:** C (Preserve all existing work) · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa`
**HEAD:** `8c70be6` (`codex/appointment-integration-v1`, in sync with origin) · **mode: read-only; nothing deleted or overwritten**

---

## 1. Preservation result

**All pre-existing work intact.** `git status --short --branch` is identical before (Session start) and after (post-verification-run): same 12 modified tracked files, same untracked set, same branch, no staged entries, no stashes. Every important file was SHA-256-hashed fresh today; hashes are recorded below as the preservation baseline for any future authorized mutating stage.

## 2. Modified tracked files (12) — hash + delta

`git diff --numstat` (fresh):

| File | + / − | SHA-256 | Size |
|---|---|---|---|
| `NEXA_HANDOFF.md` | 5/0 | `94CC1826E4FDE6C9F8A7410CB02EDECAB471D6AB2B335902149E0508E9E9CACD` | 39,411 B |
| `app/api/integrations/google-calendar/callback/route.ts` | 6/5 | `41A70B8BE881B4AD03E89009DDEB8AD39A4A8364649716420C9893DDFEEC448D` | 3,726 B |
| `app/api/integrations/google-calendar/configure/route.ts` | 4/4 | `2DD98FABBB072F97352D617BB65D0C112D478372CCD9902F0ADEC6BD982EB115` | 3,439 B |
| `app/api/integrations/google-calendar/connect/route.ts` | 5/2 | `DF7586C2475A9380547343BA277E5771C383C93430F8F9099B547F5A2F64C941` | 3,016 B |
| `app/api/integrations/google-calendar/disconnect/route.ts` | 1/0 | `9A495211766EA80CA8BD5FCDEFC57D81D8CFA027CC86D1E1C44BFECBC74049BE` | 3,209 B |
| `app/api/integrations/google-calendar/status/route.ts` | 1/0 | `A5065E2686C31EAD2FA446AC64A9EFA728F49B432AEC40AD591F9C01E9378930` | 1,811 B |
| `app/settings/team/page.tsx` | 100/9 | `BBC085562E10734AADDBB9568C14D2D5548D90DCE750BA002D01706A9E127364` | 4,757 B |
| `docs/GO_LIVE.md` | 4/0 | `6D386E4EF2924551725152DA946DFC617FB4D778BF4A29C01AD10A8B0F87BCFD` | 27,964 B |
| `lib/calendar/googleCalendarGate.test.ts` | 24/0 | `4A8462AC1851DA37C1909BAA7883CA308078119C07B506C02AC214A10489E072` | 3,273 B |
| `lib/calendar/googleCalendarGate.ts` | 44/12 | `D2EBF7BFF10ECEF1EA430E1DD5A6C1AD8B403C5A6AF2B3E3C57AC028243DAB17` | 1,912 B |
| `lib/deployPreflight.test.ts` | 33/0 | `F102E90E85D8088FEDEC0DA3C6854A14C7533716F2BD24C95D0636AFA988BB72` | 7,234 B |
| `lib/deployPreflight.ts` | 21/12 | `EF383162CBEAEB40F69DABA5B3D8CECA30F08C1F246B9F6FFB8E6076E0BFEF81` | 4,544 B |

Aggregate +248/−44 (as previously reported). `git diff --cached --stat` = empty (nothing staged).

## 3. Untracked files (individual) — hash + size

| File | SHA-256 | Size |
|---|---|---|
| `components/calendar/GoogleCalendarConnection.tsx` | `3AED5D6DE0D5E59F9531D099236C2540A3AFEB6FC7E53EEED0F5161B15FAAF41` | 4,746 B |
| `docs/BLUEPRINT_PERCENTAGE.md` | `E29CCED3A105B3461B396A6C27CDD80D4B4E5485F0D3176E1BA6D003986E0D93` | 3,146 B |
| `docs/STAGING_OAUTH_CONSENT_RUNBOOK.md` | `72BFCB7E5429E1D7D68C026F49A3F0B4EE97E328D04DE57F01001EF8F22059DD` | 6,850 B |
| `page.tsx` (root) | `566F9E505EE8668ECFF0D2BA8E860FFA605EDDF490EA55EAB4A89FA6196B0FBB` | 4,786 B |
| `route.ts` (root) | `41A70B8BE881B4AD03E89009DDEB8AD39A4A8364649716420C9893DDFEEC448D` | 3,726 B |
| `docs/PHASE_A_ARCHITECTURE_BASELINE.md` | `73AA45F436D52E010D95BDB09C25E686EB7B962AF377D3B2E8B7EA15FC53C8CE` | 8,800 B |
| `docs/PHASE_A_CALENDAR_REVIEW.md` | `4E999029DDBE2751B6A8C4B4ABEF81C53162A7D666022F5130A002C5F03A5744` | 9,169 B |
| `docs/PHASE_A_FINAL_REPORT.md` | `5839054B717BF3BE7B6374D1FAD330CC9DB52A4A1920E3362AF85F1D7C090A3C` | 11,787 B |
| `docs/PHASE_A_GIT_INVENTORY.md` | `EC85858EBAF54A47B50079A04DC6032C609591A85E4865B54E20EAA896D0DC2D` | 12,844 B |
| `docs/PHASE_A_OWNER_BLOCKERS.md` | `9A43159DD47C1C0E9B1455F2E679256B4FF0955CA0125730157E7D6B47845CCB` | 7,441 B |
| `docs/PHASE_A_SECURITY_AUDIT.md` | `31A5D4FAE433D0968231408801A293FFFB2B2FAD71BE3AF0CBF77854AD16E66E` | 7,073 B |
| `docs/PHASE_A_VERIFICATION_REPORT.md` | `5562D141A399C7EA60345EA7774B0C1B86BB1D8EC0AEF35A5F4DFC8167BEFC92` | 7,501 B |
| `docs/PHASE_A_WHATSAPP_PROTECTION.md` | `B820B143F575458A8DB60DE017298C5B11DA902DED2477F4B94566B37912693B` | 5,586 B |
| root `route.ts` duplicate confirmation | see duplicates § | — |

Plus directory-level entries from `ls-files --others` grouping: `docs` (10), `page.tsx`, `route.ts`, `components` (1), `.codex-worktrees` (1 entry = registered worktree, whose own contents belong to its branch).

## 4. Refs / worktrees / stash / artifacts

- Heads: as in `MERGE_HARDEN_GIT_DIVERGENCE.md` §1 (HEAD `8c70be6` synced; `main` `06679d9`; `origin/main` `3c10dca`).
- Worktrees (fresh `git worktree list`): main repo @`8c70be6` [branch clean-modified]; `.codex-worktrees/pr219-reconcile` @`3e02172` [codex/migration-replay-ci, clean]; 5 stale `prunable` registrations for `Temp\opencode\nexa-*` dirs (branches kept; prune deferred per MH-A A10).
- Stash: empty.
- Frozen Phase A build artifacts: `C:\Users\ys725\AppData\Local\Temp\opencode\phase-a\frozen-next-20261107\` (preserved original `.next`), Phase A logs under `C:\Users\ys725\AppData\Local\Temp\opencode\phase-a\`.
- Fresh (this session): build log `Temp\opencode\mh-build-20261107.log`, audit JSON `Temp\opencode\mh-audit-20261107.json`. `.next/` regenerated locally (BUILD_ID `YlYbA_DahfD0FyTlwunD_` — see MH-G).

## 5. Duplicate investigation (no deletion performed)

### 5.1 Root `route.ts`
- SHA-256 `41A70B8B…` **byte-identical** to `app/api/integrations/google-calendar/callback/route.ts` (same hash, same size 3,726 B — matches Phase A blob evidence).
- Framework discovery: root level is outside `app/` (Next 16 route conventions); per Phase A build evidence and the fresh 40/40 route table, the root copies generate **no routes**. Dead-weight only.
- Reference scan (grep `callback/route` over `{ts,tsx,js,mjs,json,md}`): only docs name the *canonical* path; no tooling/test imports the root copy.

### 5.2 Root `page.tsx`
- SHA-256 `566F9E50…` ≠ team page `BBC08556…` (4,786 vs 4,757 B). Content diff (git `diff --no-index`): **exactly one rendering line** — team page `Joined <time …>` vs root copy `Joined{" "}` + `<time …>` — i.e. a stray near-duplicate of the team settings page, off by a JSX whitespace fix.
- Reference scan (`page\.tsx`): all matches are valid `app/**` references and repo docs; none reference the root copy.

### 5.3 Assessment
Both root files are accidental strays (probably editor/agent artifacts of the calendar work). They are inert (not routed, not imported, not tested). **Preserved untouched;** deletion remains owner-only per MH-A A11. If later authorized: deleting neither changes app behavior; the working tree diff of the team page remains the surviving intent.

## 6. Preservation plan for an authorized mutating stage (proposal-ready)

If and only if operator steps (commit/merge) are authorized:
1. Freeze inputs: record `HEAD`, branch, `status`, full hashes (this document) into the stage's run log.
2. Copy-out: `robocopy <repo> %TEMP%\opencode\phase-h\preserve\ /E` **excluding** `.next`, `node_modules`, `.codex-worktrees` (registered worktree kept in place) — then verify per-file SHA-256 against §2–3 manifest; mismatch ⇒ stop before any Git mutation.
3. Simultaneously commit nothing until capture is verified; staging (`git add`) only after owner-approved exact file list.
4. No credentials/secret values are stored; the manifest documents files-by-hash only (secret-guard PASS already).

Failure of step 2 verification ⇒ operator halts at the authorization boundary (no mutation), consistent with master prompt §5.

## 7. Integrity checks supporting preservation claims

- Environment: OneDrive client running (PID 14092) at evidence time; 26 files hydrated and hashed successfully (no placeholder errors).
- `git fsck --full` fresh: exit 0 (dangling-only output; no corruption).
- Post-verification `git status`: unchanged (evidence in MH-G §6).
- Secret guard (`check:tracked-secrets`): PASS — tracked files carry no secrets.
