# AI Employee card navigation v1

Each AI Employee card now uses a real Next.js link for its “Manage AI Employee” destination instead of a click handler that performs client-only routing. The destination remains the same protected employee route, while keyboard activation, link semantics, copying the destination, and standard browser navigation behavior work without JavaScript-specific button handling.

This change does not alter employee loading, identifiers, ownership checks, lifecycle state, database access, or route protection. The destination remains independently authenticated and owner-scoped.

Focused static contract coverage protects the semantic link destination and prevents reintroducing `useRouter()` or `router.push()` in the card. Authenticated browser/device and assistive-technology testing remain separate release evidence.
