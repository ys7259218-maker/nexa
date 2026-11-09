export type AgentRuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type AgentRuntimeGateReason = "enabled" | "flag_off" | "production";

export type AgentRuntimeGate = {
  enabled: boolean;
  reason: AgentRuntimeGateReason;
};

/**
 * B1 kill switch. The only enabling value is the exact string "true"; every
 * absent, empty, ambiguous, or differently-cased value is off. The gate is
 * hard-off in any production build or production Vercel environment, so a
 * copied flag cannot activate the engine in production.
 *
 * The flag is intentionally not part of `SAFE_BETA_FLAGS`: that registry
 * requires every entry to be explicitly present in deployment environments,
 * and B1 has no deployment. Keeping the gate self-contained means adding it
 * cannot weaken or block an existing deployment preflight.
 */
export function inspectAgentRuntimeGate(
  environment: AgentRuntimeEnvironment,
): AgentRuntimeGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment["AGENT_RUNTIME_ENABLED"] !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isAgentRuntimeEnabled(
  environment: AgentRuntimeEnvironment = process.env,
): boolean {
  return inspectAgentRuntimeGate(environment).enabled;
}

export function agentRuntimeGateLabel(gate: AgentRuntimeGate): string {
  switch (gate.reason) {
    case "enabled":
      return "Enabled for non-production mock execution";
    case "production":
      return "Hard-off in production";
    default:
      return "Disabled (default)";
  }
}
