# Recent activity semantics v1

The dashboard Recent Activity panel now exposes a named section, a semantic list of stored activity records, and an explicit empty-state status. This improves keyboard and assistive-technology navigation without changing the records, ordering, messages, queries, or workspace ownership controls.

The existing honest boundary is unchanged: the panel displays stored owner-scoped activity only. This slice does not create activity, contact providers, enable integrations, or add telemetry.

Focused static contract coverage protects the associated heading, record-list structure, and empty-state status. Authenticated browser/device and assistive-technology testing remain separate release evidence.
