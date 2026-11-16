# B7 SECURITY TEST MATRIX — proposal for the B7 execution instruction

> Operator-prepared test design. It authorizes nothing and records no owner decision. It is an annex to `docs/B7_EXECUTION_INSTRUCTION_DRAFT.md` and is only meaningful once OD-B10, OD-B4 and the signed B7 instruction exist.

**Prepared:** 2026-11-16
**Baseline:** `main` @ `6f17c52`
**Rule:** every case below runs against the **mock driver** with no network access. Real-browser runs happen only after OD-B4 is signed, and never inside `npm test`.

---

## 1. Why this annex exists

The blueprint's B7 acceptance line is short: "all side-effecting site actions approval-gated with evidence; allow-list enforced; session teardown wipes state; full audit." That is not testable as written. This matrix turns it into concrete, fail-closed cases so implementation and review agree on what "done" means.

---

## 2. Cases

### 2.1 URL and domain policy (draft scope C2)

| ID | Scenario | Expected (fail closed) | Evidence |
|---|---|---|---|
| SP-01 | Empty allow-list, any navigation attempt | Denied before any driver call | policy decision record |
| SP-02 | Host on the tenant allow-list | Allowed | decision record |
| SP-03 | Sibling subdomain not listed (`evil.example.com` when `example.com` listed) | Denied unless `*.example.com` is explicitly listed | decision record |
| SP-04 | Cyrillic/Greek look-alike host (`аpple.com`) | Denied after punycode normalisation | normalised host in record |
| SP-05 | `javascript:`, `data:`, `file:` or `blob:` URL | Denied | reason code |
| SP-06 | 302 redirect from an allowed host to an unlisted host | Denied before the redirect target renders | redirect chain recorded |
| SP-07 | IP literal or resolution into loopback/private/link-local/metadata (`127.0.0.1`, `10/8`, `169.254.169.254`, `::1`) | Denied before navigation (DNS-rebinding guard) | resolved address recorded |
| SP-08 | Non-default port outside an owner-approved set | Denied | reason code |
| SP-09 | Allow-list entry with embedded credentials (`https://user:pass@host`) | Denied | reason code |

`SP-06` and `SP-07` are proposed **additions** to draft C2; the current draft only names normalisation and punycode. The owner may accept or strike them.

### 2.2 Evidence (draft scope C3)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| EV-01 | Approved side-effecting action | Before/after descriptors exist with URL, timestamp, screenshot hash, DOM hash | two descriptor rows |
| EV-02 | Descriptor write fails | The action is treated as failed and reported; no "success" claim | typed failure |
| EV-03 | Evidence payload is large | Stored in sandbox storage; database holds pointer/hash only | row size bounded |
| EV-04 | Task deletion cascade | Evidence rows and objects removed with the task | cascade test |
| EV-05 | Evidence read by another workspace | Denied by RLS | RLS test |

### 2.3 Approval gate (draft scope C4)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| AP-01 | Form submit without approval | Blocked; no driver call | blocked decision |
| AP-02 | Approval denied by user | Blocked; reason surfaced | decision record |
| AP-03 | Approval expired or revoked before execution | Blocked | decision record |
| AP-04 | Approval granted for URL A, action attempted on URL B | Blocked (no reuse across target) | mismatch reason |
| AP-05 | Approval prompt content | Shows exact target URL and plain-language action | snapshot test |
| AP-06 | Upload sourced outside tenant staging | Blocked before transfer | reason code |
| AP-07 | Download requested to host filesystem | Blocked; sandbox path only | reason code |
| AP-08 | Approval store read error | Fail closed, never default-allow | typed failure |

### 2.4 Session lifecycle (draft scope C5)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| SL-01 | TTL reached mid-session | Driver closed, profile wiped, session marked ended | teardown status |
| SL-02 | Idle timeout | Same as SL-01 | teardown status |
| SL-03 | Kill switch during an action | Action aborted, session ended, reason audited | audit row |
| SL-04 | Teardown partially fails | Reported as `teardown_failed`, never silently "closed" | typed failure |
| SL-05 | Profile remnants after teardown | Zero files in the session sandbox (mock asserts emptiness) | cleanup assertion |
| SL-06 | Session row read from another workspace | Denied by RLS | RLS test |

### 2.5 Manifests and tiering (draft scope C6)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| MF-01 | Flag `BROWSER_AGENT_ENABLED` unset/false | `browser.*` manifests absent from the registry | registry snapshot |
| MF-02 | Flag true | Exactly the three reviewed manifests register, hash-verified | registry snapshot |
| MF-03 | `browser.act` risk tier | `T4`; policy engine never auto-approves it | manifest + policy test |
| MF-04 | Computer-use manifest | Absent and unregisterable (OD-B10) | registry snapshot |
| MF-05 | Manifest schema drift | Registry refuses to load (existing strict validation) | load failure |

### 2.6 Driver and offline discipline (draft scope C1/G)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| DG-01 | Default environment | Mock driver selected; zero network sockets opened | test harness assertion |
| DG-02 | `BROWSER_DRIVER=playwright` with binaries absent | Typed "browser unavailable" error; no install attempt | error shape |
| DG-03 | Unit test suite | No real browser launch, no `npx playwright install` | command audit |
| DG-04 | Provider/WhatsApp/calendar modules | Unchanged and unimported by the browser module | import graph test |

---

## 3. Gate mapping

| Draft row | Cases |
|---|---|
| C1 browser boundary | DG-01, DG-02, DG-03, DG-04 |
| C2 session policy | SP-01 … SP-09 |
| C3 evidence | EV-01 … EV-05 |
| C4 approval gate | AP-01 … AP-08 |
| C5 lifecycle/kill switch | SL-01 … SL-06 |
| C6 manifests/T4 | MF-01 … MF-05 |
| C7 persistence | EV-05, SL-06 |

All 37 cases must be green in `npm test` (mock driver) before a B7 PR is opened. Real-browser acceptance, if OD-B4 allows it, is a separate, explicitly reported run — never a substitute for the mock suite.

---

## 4. Open design points for the owner

These are called out rather than silently decided:

1. **DNS-rebinding guard (SP-07):** does the owner want resolve-time private-range blocking in B7, or defer it to the container stage (OD-B4 Option B)?
2. **Redirect policy (SP-06):** deny on first off-list hop, or allow the driver to follow and record? The draft assumes deny.
3. **Approval lifetime (AP-03):** the B3 engine has its own expiry; B7 can inherit it or set a shorter per-action window.
4. **Download destination (AP-07):** sandbox object storage only — confirm no host write path is acceptable.
5. **Evidence retention:** follows the task cascade for now; OD-B5 retention windows may override later.

**Status:** `B7 SECURITY TEST MATRIX PROPOSED — 37 CASES — NO OWNER DECISION RECORDED — NO B7 CODE`
