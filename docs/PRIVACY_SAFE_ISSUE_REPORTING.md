# Privacy-Safe Issue Reporting v1

This rollout-gated feature lets an authenticated workspace member submit a bounded issue report. It stores only the selected category, user-entered title and description, immutable reporter/workspace identity, status, and creation time.

It does **not** automatically collect or attach logs, request headers, cookies, URLs or query strings, environment values, stack traces, message bodies, phone numbers, tokens, device data, screenshots, files, hidden telemetry, or customer data. It does not send email or contact an external support provider.

## Access and integrity

- Every member may submit for their current workspace through `create_issue_report`.
- A reporter may read their own reports. Workspace Owners and Admins may read workspace reports. Operators and Viewers cannot read another reporter''s text.
- Browser roles receive `SELECT` only. Creation is a guarded `SECURITY DEFINER` RPC with an authenticated membership check and fixed search path.
- Workspace and reporter identity are derived by the database, never accepted from report fields.
- Audit metadata contains only report ID, category, status, actor, workspace, and time. It never copies title or description.

## Rollout and limitations

Keep `ISSUE_REPORTING_ENABLED=false` until the migration has passed fresh-install, upgrade, multi-account, cross-workspace, reporter/Owner/Admin/Operator/Viewer, and direct-write tests in a dedicated synthetic Supabase project. No live migration is part of this change.

Reports are retained until a separately reviewed retention/deletion workflow exists. Do not promise deletion, support response times, resolution, monitoring, or notification. To roll back before use, disable the flag. After data exists, preserve it and use an approved migration or verified backup procedure rather than dropping the table.
