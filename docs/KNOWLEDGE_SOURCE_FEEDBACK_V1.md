# Knowledge Source Registry feedback v1

Status: implemented behind the existing disabled rollout gate.

## Included

- Website and PDF/TXT metadata fields have persistent labels, stable ids/names, and the existing typed validation bounds.
- Create, manual-review, and delete controls expose pending state while their guarded operations run.
- Focused live feedback distinguishes validation/operation failures from successful metadata-only actions.
- Deletion still requires explicit browser confirmation and returns a content-free receipt.
- The interface continues to state that Nexa does not upload, visit, crawl, download, parse, embed, retrieve, or use reference content in AI replies.

The existing authenticated Supabase browser client, guarded RPCs, workspace/RLS/role protections, rollout flag, content-free audit metadata, and typed validation are unchanged. No migration, live database action, deployment, flag/provider enablement, production/customer data access, secret, outbound message, upload, crawl, parse, embedding, retrieval, or external-account change is included.

This is a bounded form-feedback/accessibility improvement, not evidence that the registry migration or role matrix has passed dedicated-project integration tests.
