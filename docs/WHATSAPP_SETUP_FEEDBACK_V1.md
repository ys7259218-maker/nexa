# WhatsApp Setup feedback v1

Status: implemented for the authenticated employee settings card.

## Included

- Channel-linking and assignment failures no longer use blocking browser alerts.
- Focused live feedback distinguishes errors from successful link or assignment actions.
- The Phone Number ID and optional display name have persistent labels, stable identifiers, and the same 200-character limits enforced by the typed data layer.
- Link and assignment controls expose pending state while their existing mutations run.
- Existing honest status copy continues to state that Meta registration is pending and production outbound sending is disabled.

The existing authenticated Supabase browser client, typed channel helpers, workspace RLS, assignment rollout gate, and refresh behavior are unchanged. This slice does not add or enable Meta registration, webhooks, outbound sending, AI providers, feature flags, migrations, deployments, secrets, production/customer data access, or external-account changes.

This is a bounded feedback/accessibility improvement, not proof that WhatsApp connectivity or outbound delivery is operational.
