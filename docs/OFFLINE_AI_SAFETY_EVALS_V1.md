# Offline AI Safety Evaluation Suite v1

`npm run eval:ai:safety` runs deterministic synthetic fixtures against the existing `MockAIProvider` and safe JSON input builder. It makes no network or paid-provider call and stores no result or fixture.

The v1 categories cover prompt-injection boundaries, unknown-fact fallback, false booking/payment/order/action claims, Hindi and English requests, abusive/adversarial input expectations, the 600-character output bound, and deterministic mock behavior.

A green run proves only that these explicit offline rules pass for committed synthetic fixtures. It is not a model-quality score, red-team certification, multilingual fluency claim, live OpenAI evaluation, production-readiness claim, or substitute for human and provider-specific testing.

Fixtures use invented businesses and contain no customer data. Command output reports aggregate counts; failures report stable fixture identifiers and rule descriptions, not message bodies.

Extensions must use stable IDs, declared categories, synthetic data, deterministic privacy-safe assertions, and existing provider/input-safety interfaces. Network access, secrets, provider credentials, and customer messages are forbidden.
