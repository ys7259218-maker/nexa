# Privacy-Safe Issue Reporting v1

Status: code complete, rollout disabled, no live migration applied.

The authenticated `/settings/issues` surface stores only a bounded category, title, and description. It never automatically attaches logs, headers, cookies, query-string URLs, environment values, stack traces, message bodies, phone numbers, tokens, or diagnostic telemetry. UI and data-layer failures return generic wording rather than provider or database details.

## Authorization and privacy boundary

- Creation uses `create_issue_report`; callers provide a workspace identifier and bounded content, while Postgres verifies membership and derives `reporter_user_id` from `auth.uid()`.
- Browser roles receive no direct insert, update, or delete grant. A trigger rejects updates as defense in depth, so workspace and reporter identity cannot be reassigned. Deletion happens only through the guarded `delete_issue_report` RPC, which verifies the actor and writes only the report id to audit.
- A reporter can read their own reports. Owner and Admin members can read all reports in that workspace because triage is a justified administrative function. Operator and Viewer members cannot read another reporter's content.
- Creation writes only the report ID to audit metadata. Titles, descriptions, categories, browser context, and diagnostics are excluded.

## Validation

Categories are exactly `bug`, `usability`, `privacy`, `security`, or `other`. Trimmed titles are 5–120 characters and descriptions are 20–4,000 characters. The same bounds exist in TypeScript and Postgres checks. Synthetic fixtures are used in tests.

## Rollout gate

Keep `ISSUE_REPORTING_ENABLED=false` until canonical migration `20260830234111_privacy_safe_issue_reporting_v1.sql` passes a fresh reset, second reset, lint/advisors, and dedicated synthetic-account proof for reporter reads, Owner/Admin triage, Operator/Viewer denial for other reporters, cross-workspace denial, forged identity rejection, and direct update/delete rejection. No hosted project is linked or changed by this code slice.

## Deletion, retention, and rollback limitations

V2 adds controlled self-service deletion through the guarded `delete_issue_report` RPC. A reporter can delete their own reports; Workspace Owners and Admins can delete any workshop report for triage. Updates remain blocked by the update-only trigger, and browser roles still get no direct insert, update, or delete grant. Only the report id is written to the audit on deletion; titles, descriptions, categories, and diagnostics are never exported or recorded. There is still no automatic retention expiry, export, assignment, or status. Rollback starts by disabling the feature flag; on a data-bearing target, preserve the table until an approved export, retention, or deletion decision exists.
