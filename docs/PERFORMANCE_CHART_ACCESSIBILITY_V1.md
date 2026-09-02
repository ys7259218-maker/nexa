# Performance Chart Accessibility V1

## Scope

The dashboard performance chart keeps its existing visual presentation while
providing an equivalent day-by-day call summary for screen readers. Its title
and description now label both the chart and the honest no-data state.

## Safety boundary

- No call totals, date grouping, queries, chart rendering, or empty-state copy changed.
- The generated Recharts visualization is decorative to assistive technology;
  the same values are exposed through a visually hidden list.
- No database, environment, deployment, provider, Meta, or production settings changed.

## Verification

`lib/uiContracts.test.ts` protects the labeled figure, hidden visual chart,
equivalent text summary, pluralized values, and named empty-state status.
