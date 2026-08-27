# Nexa Development Operating System

This document is the durable operating contract for Nexa development. GitHub is the master source of truth; work continues from this repository and is never rebuilt from chat history or a temporary workspace.

## Roles

- **ChatGPT Work / Codex — Manager and architect:** selects the highest-value bounded task, protects architecture and production, makes security decisions, reviews important changes, validates results, and saves verified progress.
- **OpenCode — implementation:** handles bounded heavy coding, refactoring, repetitive repository changes, and test implementation on an isolated branch.
- **Kimi — independent review:** provides large-context analysis, second opinions, and gap reviews when that adds value.
- **GitHub — master source of truth:** only reviewed, verified work represented in GitHub is durable project state.
- **Supabase — database, authentication, and RLS:** changes use reviewed migrations and dedicated test environments, never uncontrolled production writes.
- **Vercel — deployment; Playwright — end-to-end tests; Sentry — error monitoring.**
- **Nexa AI Engine and channels:** core business logic with WhatsApp, calls, and later channels behind safe runtime boundaries.

PostHog and Langfuse are introduced only when real customers make product analytics and AI tracing necessary. Google Cloud, Zoho, and Odoo remain future options that require a concrete Nexa need.

## Safe delivery pipeline

Use this sequence:

1. Choose the current highest-priority business problem and bound the scope.
2. Inspect only the relevant repository files and documentation.
3. Work on an isolated branch or worktree.
4. Implement the smallest correct solution.
5. Run relevant tests, lint, typecheck, production build, security checks, migration/RLS checks, and tenant-isolation checks.
6. Review the diff and confirm no secret or customer data is present.
7. Save verified progress to GitHub.
8. Deploy only through the controlled release gates.

Do not experiment directly on production. Coding tools do not receive production database access and do not push directly to `main`.

## Source-sharing and secret boundary

Secret-free private Nexa source is authorized for bounded OpenCode implementation and Kimi review. Never share or commit `.env`, `.env.local`, API keys, access tokens, service-role keys, passwords, private credentials, customer data, production secrets, or raw production payloads. Before sharing source with an external coding/review tool, inspect the selected files and exclude local environment files and generated secret material.

## Efficient mode

Maximize useful Nexa progress without reducing engineering quality:

- keep routine reporting concise and use repository documentation as durable memory;
- patch small areas instead of regenerating whole files;
- batch related safe checks and avoid repeated audits when the code has not changed;
- use OpenCode for substantial bounded implementation and Kimi only for valuable independent review;
- do not ask for information that can be safely discovered in the repository;
- never skip necessary tests, lint, type checking, build verification, security/RLS checks, authorization checks, or data-isolation checks to save usage.

## External blockers

External failures such as Meta WhatsApp phone registration are isolated. Outbound behavior remains safely disabled while unrelated Nexa development continues with mocks and dedicated test environments.

## Product principle

Nexa is a globally scalable, multi-tenant AI business-agent platform. Major work must solve a real business problem and prioritize reliability, security, real AI actions, automation, tenant isolation, scalability, maintainability, and customer value over decorative features.

## Progress reporting

Routine reports use only:

- **DONE:** completed work.
- **VERIFIED:** checks that actually ran.
- **BLOCKED:** real blockers only.
- **NEXT:** the single highest-priority next task.

Keep `NEXA_PROJECT_RECAP.md` and relevant technical documentation synchronized with important decisions and milestones, not trivial edits.
