# Authenticated sign-out feedback v1

Dashboard sign-out now prevents duplicate requests, exposes its pending state, and redirects to login only after Supabase confirms that sign-out succeeded. Missing client configuration, provider failures, and unexpected errors keep the owner on the authenticated surface and show focused generic feedback that clearly warns the session may still be active.

The feedback does not expose provider details, tokens, cookies, account identifiers, or backend responses. This slice does not change session storage, authentication configuration, production accounts, or deployment settings.

Focused static contract coverage protects the confirmed-success redirect, pending state, duplicate-request guard, generic failure wording, and focused live feedback. Authenticated browser/device and assistive-technology testing remain separate release evidence.
