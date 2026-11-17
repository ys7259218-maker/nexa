/**
 * Phase B B8 observability kill switch (scope C5c/C5d).
 *
 * The surface is double-gated: `AGENT_OBSERVABILITY_ENABLED` must be the
 * exact string "true" and the existing `AGENT_RUNTIME_ENABLED` must also be
 * "true". Production is hard-off even when both flags are copied into the
 * environment. `lib/agent/gate.ts` is deliberately not modified.
 */

export type AgentObservabilityEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type AgentObservabilityGateReason =
  | "enabled"
  | "flag_off"
  | "runtime_off"
  | "production";

export type AgentObservabilityGate = Readonly<{
  enabled: boolean;
  reason: AgentObservabilityGateReason;
}>;

export function inspectAgentObservabilityGate(
  environment: AgentObservabilityEnvironment,
): AgentObservabilityGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment["AGENT_OBSERVABILITY_ENABLED"] !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  if (environment["AGENT_RUNTIME_ENABLED"] !== "true") {
    return { enabled: false, reason: "runtime_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isAgentObservabilityEnabled(
  environment: AgentObservabilityEnvironment = process.env,
): boolean {
  return inspectAgentObservabilityGate(environment).enabled;
}

export function agentObservabilityGateLabel(
  gate: AgentObservabilityGate,
): string {
  switch (gate.reason) {
    case "enabled":
      return "Enabled for non-production read-only observability";
    case "runtime_off":
      return "Disabled: agent runtime flag is off";
    case "production":
      return "Hard-off in production";
    default:
      return "Disabled (default)";
  }
}
