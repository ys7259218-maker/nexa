# Voice, phone, and knowledge settings feedback v1

Status: implemented for the three authenticated metadata cards.

## Included

- Voice preferences, phone setup metadata, and legacy knowledge references no longer use blocking browser alerts.
- A shared focused live-feedback component reports save failures and success without exposing backend details.
- Every field has a persistent visible label, stable id/name, and a browser length bound matching the typed data layer.
- Forms and submit buttons expose pending state.
- Phone and voice cards continue to state that no telephony/voice runtime is connected.
- The legacy knowledge card continues to state that references are metadata only, with no upload, crawl, index, retrieval, or AI use.

The existing authenticated Supabase client, typed update helper, RLS boundary, refresh behavior, and stored fields are unchanged. No migration, rollout flag, provider, deployment, production/customer data, secret, outbound message, upload, crawl, parse, embedding, or retrieval behavior is introduced.

This is a bounded feedback/accessibility slice, not a claim that every settings card or assistive-technology/browser combination has been audited.
