/**
 * Phase B B3 permission engine kill switch.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in any
 * production build or production Vercel environment, so a copied flag cannot
 * activate the engine in production.
 */

export type AgentPermissionEngineEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type AgentPermissionEngineGateReason = "enabled" | "flag_off" | "production";

export type AgentPermissionEngineGate = {
  enabled: boolean;
  reason: AgentPermissionEngineGateReason;
};

/**
 * B3 kill switch. Hard-off in production. The flag is intentionally not part
 * of `SAFE_BETA_FLAGS`: that registry requires every entry to be explicitly
 * present in deployment environments, and B3 has no deployment. Keeping the
 * gate self-contained means adding it cannot weaken or block an existing
 * deployment preflight.
 */
export function inspectAgentPermissionEngineGate(
  environment: AgentPermissionEngineEnvironment,
): AgentPermissionEngineGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment.AGENT_PERMISSION_ENGINE_ENABLED !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isAgentPermissionEngineEnabled(
  environment: AgentPermissionEngineEnvironment = process.env,
): boolean {
  return inspectAgentPermissionEngineGate(environment).enabled;
}

export function agentPermissionEngineGateLabel(
  gate: AgentPermissionEngineGate,
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
