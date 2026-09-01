# Privacy-Safe Issue Reporting v1

Status: code complete, rollout disabled, no live migration applied.

The authenticated `/settings/issues` surface stores only a bounded category, title, and description. It never automatically attaches logs, headers, cookies, query-string URLs, environment values, stack traces, message bodies, phone numbers, tokens, or diagnostic telemetry. UI and data-layer failures return generic wording rather than provider or database details.

## Authorization and privacy boundary

- Creation uses `create_issue_report`; callers provide a workspace identifier and bounded content, while Postgres verifies membership and derives `reporter_user_id` from `auth.uid()`.
- Browser roles receive no direct insert, update, or delete grant. A trigger rejects updates and deletes as defense in depth, so workspace and reporter identity cannot be reassigned.
- A reporter can read their own reports. Owner and Admin members can read all reports in that workspace because triage is a justified administrative function. Operator and Viewer members cannot read another reporter's content.
- Creation writes only the report ID to audit metadata. Titles, descriptions, categories, browser context, and diagnostics are excluded.

## Validation

Categories are exactly `bug`, `usability`, `privacy`, `security`, or `other`. Trimmed titles are 5–120 characters and descriptions are 20–4,000 characters. The same bounds exist in TypeScript and Postgres checks. Synthetic fixtures are used in tests.

## Rollout gate

Keep `ISSUE_REPORTING_ENABLED=false` until canonical migration `20260830234111_privacy_safe_issue_reporting_v1.sql` passes a fresh reset, second reset, lint/advisors, and dedicated synthetic-account proof for reporter reads, Owner/Admin triage, Operator/Viewer denial for other reporters, cross-workspace denial, forged identity rejection, and direct update/delete rejection. No hosted project is linked or changed by this code slice.

## Deletion, retention, and rollback limitations

V1 has no self-service deletion, automated retention expiry, export, assignment, status, or outbound notification. Reports remain in the workspace database until a separately reviewed operator/deletion workflow removes them. This is a deliberate closed-beta limitation, not a deletion guarantee. Rollback begins by disabling the feature flag; on a data-bearing target, preserve the table until an approved export, retention, or deletion decision exists.
