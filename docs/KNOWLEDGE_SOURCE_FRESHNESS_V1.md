# Knowledge Source Registry v1.1: manual freshness and deletion receipts

Status: implemented in code, rollout-gated, not applied or enabled.

This slice adds manual metadata-review timestamps and a review-due date from 1 through 365 days. “Reviewed” means a workspace operator reviewed the saved reference metadata; it does not mean Nexa visited a website, opened a file, checked facts, scanned malware, parsed content, or verified accuracy.

Owner, Admin, and Operator roles use guarded database functions to record review or delete a reference. Direct browser update/delete privileges are removed. Viewer remains read-only. Every deletion atomically creates a workspace-scoped receipt containing only identifiers, source kind, actor identifier, and deletion time. It retains no label, URL, file name, file size, source content, derived content, or AI data.

Keep `KNOWLEDGE_SOURCE_REGISTRY_ENABLED=false` until migrations through `20260829162004_knowledge_source_freshness_v1.sql` pass fresh and second local resets plus dedicated synthetic role and cross-workspace tests. Verify interval bounds, direct-write denial, content-free audit metadata, receipt immutability/privacy, atomic deletion, and employee-cascade behavior.

No hosted migration, deployment, flag/provider change, upload, crawl, parse, embedding, retrieval, AI use, or external message is authorized by this code.

Rollback starts by keeping the flag false. Prefer an approved additive correction or restoration from the recorded isolated-test backup; do not casually drop receipt evidence.
