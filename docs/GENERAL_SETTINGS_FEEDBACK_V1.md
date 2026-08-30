# General Settings feedback baseline v1

Status: implemented for the authenticated AI Employee General Settings card.

## Included

- Replaces blocking save/delete error alerts with focused inline feedback.
- Uses persistent visible labels and stable ids/names for every field.
- Mirrors the existing typed employee-validator limits in browser inputs and validates before a client call.
- Exposes save/delete pending state on the form and action buttons.
- Keeps the existing explicit irreversible-delete confirmation.
- Uses generic provider/database failure wording instead of exposing backend details.

Save, delete, activity recording, refresh, and navigation still use the existing authenticated Supabase client and typed data helpers under RLS. This slice changes no authorization, lifecycle, activation, schema, migration, feature flag, provider, deployment, production/customer data, secret, or outbound-message behavior.

This is a bounded settings improvement. Voice, phone, knowledge, and other settings cards still require the same feedback and accessibility audit.
