# Employee sandbox feedback v1

The protected AI Employee test sandbox now exposes its pending state to assistive technology, moves keyboard focus to each new error or simulated result, and retains a validated customer message when a safe server-side dependency fails so the owner can retry without retyping it.

The existing safety boundary is unchanged: the sandbox uses only the deterministic mock or an already verified FAQ match, does not persist the entered message or draft, does not contact an external provider or customer, and does not change lifecycle, feature flags, channel state, or outbound behavior.

Focused static contract coverage protects the pending, focus, live-region, retained-input, and no-send/no-save wording. Browser/device and authenticated assistive-technology testing remain separate release evidence.
