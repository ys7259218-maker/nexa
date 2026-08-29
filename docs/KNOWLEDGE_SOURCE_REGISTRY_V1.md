# Knowledge Source Registry v1

Status: implemented in code, rollout-gated, not applied or enabled.

## Scope

The registry stores removable source-reference metadata for one AI Employee:

- a labeled public HTTPS website URL; or
- a labeled PDF/TXT file name, matching media type, and declared size from 1 byte through 25 MiB.

This version has no file picker, upload, Supabase Storage operation, website request, crawler, downloader, parser, malware scanner, chunker, embedding, retrieval, citation, freshness check, or AI-context integration. Saving a reference never means Nexa has read, verified, or learned its contents.

## Validation and authorization

Application validation and database constraints independently enforce mutually exclusive website/file shapes. Website references require a credential-free public HTTPS domain, no fragment, and no custom port. File metadata accepts only plain file names ending in `.pdf` or `.txt`, a matching `application/pdf` or `text/plain` media type, and a bounded integer size.

`knowledge_sources` is bound to `(workspace_id, ai_employee_id)` with a composite foreign key. Workspace members may read references. Owner, Admin, and Operator roles may create through `create_knowledge_source` and delete under RLS; Viewer remains read-only. Browser clients have no direct insert or update grant, cannot choose workspace/actor identity, and cannot edit a reference after creation.

Creation and deletion add immutable audit events containing only `knowledge_source_id` and `source_kind`. Audit metadata excludes labels, URLs, file names, sizes, and source content.

## Rollout gate

Keep `KNOWLEDGE_SOURCE_REGISTRY_ENABLED=false` until canonical migration `20260829143000_knowledge_source_registry_v1.sql` has been applied in order to a backed-up dedicated test project and the following synthetic-account checks pass:

- Owner/Admin/Operator create and delete; Viewer reads but cannot create or delete.
- A second workspace cannot read, create for, or delete another workspace's source.
- Direct insert/update and forged workspace/actor fields fail.
- Invalid URL, file type, extension, path, and size shapes fail at the database boundary.
- Audit rows contain source id/kind only and remain client-immutable.
- Employee deletion removes its registry rows without producing derived content or external side effects.

The code change does not authorize a hosted migration, flag change, deployment, production/customer-data test, or ingestion implementation.

## Rollback

First set or keep the flag false. For an isolated unshared test target only, remove the trigger and functions, policies, table, and migration record using a reviewed rollback after preserving required evidence. For any shared or production-like target, restore from the recorded backup or use an owner-approved additive correction; do not run destructive SQL casually.
