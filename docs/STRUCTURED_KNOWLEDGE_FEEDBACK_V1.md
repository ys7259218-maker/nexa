# Structured Knowledge feedback v1

Status: implemented behind the existing disabled Knowledge v0 rollout gate.

## Included

- FAQ/note type, title, question, content, and verification controls have persistent label associations and stable identifiers.
- Existing typed title, question, and content length bounds remain exposed in the browser.
- Create, update, and delete controls expose pending state while their authenticated mutations run.
- Focused live feedback distinguishes validation/operation failures from successful create, save, and delete actions.
- Delete still requires explicit browser confirmation.
- Existing honest copy continues to state that Knowledge v0 performs no file upload, crawling, embeddings, or hidden ingestion.

The authenticated Supabase browser client, employee/workspace-scoped typed helpers, RLS/role protections, content-free audit metadata, verified-only context boundary, and rollout flag are unchanged. No migration, live database action, deployment, flag/provider enablement, production/customer data access, secret, outbound message, upload, crawl, parse, embedding, retrieval, or external-account change is included.

This is a bounded feedback/accessibility improvement, not dedicated-project proof of the Knowledge v0 migration or role matrix.
