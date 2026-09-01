# Dashboard record semantics v1

The stored Calls and Upcoming Appointments panels now expose named sections, semantic lists, list items, and explicit empty-state status text. Decorative phone, calendar, clock, location, and chevron icons are hidden from assistive technology so they do not repeat information already provided as text.

The existing honest product boundary is unchanged: these panels display owner-scoped stored records only and do not claim live telephony or booking automation. This slice does not create records, change queries, contact providers, or enable integrations.

Focused static contract coverage protects the associated headings, list structure, empty-state semantics, and decorative-icon treatment. Authenticated browser/device and assistive-technology testing remain separate release evidence.
