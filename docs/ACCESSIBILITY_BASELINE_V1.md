# Accessibility Baseline v1

Status: implemented for the authenticated application shell; broader audit remains open.

## Scope

- A keyboard-visible “Skip to main content” link targets the single authenticated-shell main landmark.
- Sidebar and top shortcut navigation have explicit accessible names.
- Interactive controls receive a consistent high-contrast visible focus outline.
- The global reduced-motion preference collapses nonessential animation and transition duration without hiding content or changing application behavior.

This slice changes no authentication, authorization, database, provider, message, deployment, migration, or feature-flag behavior. It does not claim WCAG conformance or completion of responsive, screen-reader, zoom, contrast, touch-target, or end-to-end keyboard audits.

## Verification

Run `npm run check`, `npm audit --audit-level=high`, and the browser smoke gate. Manually verify keyboard order and skip-link focus on each protected core route at 200% zoom and with reduced motion before any accessibility-readiness claim.

## Rollback

Revert this additive UI commit if it causes a navigation regression. No data or external-system rollback is required.
