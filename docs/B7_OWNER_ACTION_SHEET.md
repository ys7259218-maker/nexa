# B7 OWNER ACTION SHEET — what to sign, in order

> Operator-prepared navigation sheet. It grants nothing and records no decision. Only the owner's own ticks and typed name/date count. Do not ask the operator to fill these boxes.

**Prepared:** 2026-11-16
**Baseline:** `main` @ `41a7103`
**Why you are seeing this:** B7 is the browser milestone. Three owner instruments are missing, so B7 is stopped at the gate. Everything you need to sign already exists; nothing else is pending on the operator side.

---

## Step 1 — OD-B10 (browser-only boundary)

Open `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md`, section **OD-B10 — Computer-use deferral confirmation**.

- Tick: `[ ]` **Approve recommendation (stay deferred)**
- Fill: owner rationale (optional), initials, decision date.
- What it means: B7 ships **browser only**. Computer-use stays deferred; enabling it later needs a new decision and its own authorization.
- Do not tick "Reject" unless you want B7 blocked indefinitely.

## Step 2 — OD-B4 (browser runtime + hosting)

Same file, section **OD-B4 — Playwright runtime browsers + browser service hosting**.

- Tick: `[ ]` **Approve recommendation (staged A→B)**
- Fill: owner rationale (optional), initials, decision date.
- What it means: Option **A** (Playwright browsers on the worker host) is allowed for closed internal testing with the T4 flag off; Option **B** (containerized browser service) is required before any real-tenant beta; Option **C** (external browser-API vendor) stays deferred.
- If you prefer a different option, use "Request changes" and write it. B7 cannot start until this row is decided.

Optional but recommended in the same sitting: **OD-B3** (worker hosting shape), because the matrix treats OD-B3 and OD-B4 as one hosting family. OD-B3 is **not** required to write B7 code; it is required before any operational deployment.

## Step 3 — sign the B7 execution instruction

1. Copy `docs/B7_EXECUTION_INSTRUCTION_DRAFT.md` to `docs/B7_EXECUTION_INSTRUCTION_SIGNED.md`.
2. Section A: type your name, role, date/time, timezone.
3. Section B: confirm the repository lines, and **name the source branch and the destination branch yourself** (destination must not be `main` unless you explicitly want that).
4. Sections C and E: tick Approve / Reject / Defer for each row you have actually decided. Rows you leave unticked are not approved.
5. Section L: type your name and signature again. Leave the operator acknowledgment section for the operator.
6. Do not change the operator-written facts without noting why; they were verified at `41a7103`.

The security cases in `docs/B7_SECURITY_TEST_MATRIX.md` need no signature. Review them if you want; SP-06 (redirect) and SP-07 (private-range block) and the five open design points are flagged for your preference.

---

## What happens after you sign

1. Operator creates a B7 branch from `main` and prepares a small **B7 push/PR authorization** draft (same shape as the B6 one).
2. You sign that authorization. Nothing is pushed or merged before it.
3. Implementation starts with the 37 mock-driver cases. No real browser, no new dependency, no hosted DB.
4. A B7 PR opens only when `npm run check` and every case are green. Merge waits for the signed authorization.

## What stays prohibited even after signing

- Computer-use, external browser-API vendor, credential autofill, personal browser profiles.
- `npx playwright install` unless OD-B4 explicitly chose it.
- Production deploy, hosted migrations, live provider/WhatsApp/calendar calls.
- New npm dependencies.

---

**Status:** `B7 OWNER ACTION SHEET READY — 3 SIGNATURES MISSING — NO B7 WORK PERFORMED`
