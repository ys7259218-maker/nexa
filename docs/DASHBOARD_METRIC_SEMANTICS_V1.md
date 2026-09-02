# Dashboard Metric Semantics V1

## Scope

The dashboard analytics cards now expose their existing information as a named
list of metrics. Each card is a list item, the metric title is a heading, the
metric value remains ordinary content, and the decorative icon is hidden from
assistive technology.

## Safety boundary

- No metric values, calculations, data queries, or empty-state behavior changed.
- No visual styling, animation, routing, database, environment, or production
  configuration changed.
- The dashboard continues to display only the honest values supplied by its
  existing real-data snapshot.

## Verification

`lib/uiContracts.test.ts` protects the named list, semantic card structure,
heading hierarchy, value markup, and decorative icon treatment.
