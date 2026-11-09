export type AgentToolRegistryEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type AgentToolRegistryGateReason = "enabled" | "flag_off" | "production";

export type AgentToolRegistryGate = {
  enabled: boolean;
  reason: AgentToolRegistryGateReason;
};

/**
 * B2 kill switch. The only enabling value is the exact string "true"; every
 * absent, empty, ambiguous, or differently-cased value is off. The gate is
 * hard-off in any production build or production Vercel environment, so a
 * copied flag cannot activate the registry in production.
 */
export function inspectAgentToolRegistryGate(
  environment: AgentToolRegistryEnvironment,
): AgentToolRegistryGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment.AGENT_TOOL_REGISTRY_ENABLED !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isAgentToolRegistryEnabled(
  environment: AgentToolRegistryEnvironment = process.env,
): boolean {
  return inspectAgentToolRegistryGate(environment).enabled;
}

export function agentToolRegistryGateLabel(
  gate: AgentToolRegistryGate,
): string {
  switch (gate.reason) {
    case "enabled":
      return "Enabled for non-production mock contracts";
    case "production":
      return "Hard-off in production";
    default:
      return "Disabled (default)";
  }
}
