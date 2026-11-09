/**
 * Phase B B2 tool registry contracts.
 *
 * These types are deliberately independent of any provider, network client, or
 * database driver. B2 adapters are deterministic mocks; the registry, schema
 * validator, timeout policy, and audit contract are the durable pieces.
 */

export const TOOL_TIMEOUT_CLASSES = ["fast", "standard", "long"] as const;

export type ToolTimeoutClass = (typeof TOOL_TIMEOUT_CLASSES)[number];

export type ToolTimeoutPolicy = {
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
};

/** Reviewed per-class timeout/retry policy, mirrored in the B2 design note. */
export const TOOL_TIMEOUT_POLICY: Readonly<
  Record<ToolTimeoutClass, ToolTimeoutPolicy>
> = {
  fast: { timeoutMs: 5_000, maxAttempts: 1, backoffMs: 0 },
  standard: { timeoutMs: 30_000, maxAttempts: 2, backoffMs: 250 },
  long: { timeoutMs: 120_000, maxAttempts: 2, backoffMs: 1_000 },
};

export const TOOL_ERROR_CLASSES = [
  "VALIDATION",
  "PERMISSION",
  "RATE_LIMIT",
  "TIMEOUT",
  "UPSTREAM",
  "INTERNAL",
] as const;

export type ToolErrorClass = (typeof TOOL_ERROR_CLASSES)[number];

export const RETRYABLE_TOOL_ERROR_CLASSES = [
  "RATE_LIMIT",
  "TIMEOUT",
  "UPSTREAM",
] as const;

export const TOOL_RISK_TIERS = ["T0", "T1"] as const;

export type ToolRiskTier = (typeof TOOL_RISK_TIERS)[number];

export const TOOL_INVOCATION_STATUSES = ["SUCCEEDED", "FAILED"] as const;

export type ToolInvocationStatus = (typeof TOOL_INVOCATION_STATUSES)[number];

export type ToolManifest = {
  name: string;
  version: string;
  description: string;
  timeoutClass: ToolTimeoutClass;
  maxAttempts: number;
  riskTier: ToolRiskTier;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type ToolManifestDocument = ToolManifest;

export type ToolErrorShape = {
  errorClass: ToolErrorClass;
  code: string;
  retryable: boolean;
};

export type ToolAdapterContext = {
  workspaceId: string;
  invocationKey: string;
  now: () => Date;
};

export type ToolAdapter = (
  input: Record<string, unknown>,
  context: ToolAdapterContext,
) => Promise<Record<string, unknown>>;

export type ToolAdapters = Readonly<Record<string, ToolAdapter>>;

export function toolAdapterKey(name: string, version: string): string {
  return `${name}@${version}`;
}

export function isToolTimeoutClass(value: unknown): value is ToolTimeoutClass {
  return TOOL_TIMEOUT_CLASSES.includes(value as ToolTimeoutClass);
}

export function isToolErrorClass(value: unknown): value is ToolErrorClass {
  return TOOL_ERROR_CLASSES.includes(value as ToolErrorClass);
}

export function isRetryableToolErrorClass(
  value: ToolErrorClass,
): boolean {
  return RETRYABLE_TOOL_ERROR_CLASSES.includes(
    value as (typeof RETRYABLE_TOOL_ERROR_CLASSES)[number],
  );
}
