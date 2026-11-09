/**
 * Phase B B4 planning & orchestration kill switch.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in any
 * production build or production Vercel environment, so a copied flag cannot
 * activate the planner in production.
 */

export type PlannerEnvironment = Readonly<Record<string, string | undefined>>;

export type PlannerGateReason = "enabled" | "flag_off" | "production";

export type PlannerGate = {
  enabled: boolean;
  reason: PlannerGateReason;
};

/**
 * B4 kill switch. Hard-off in production. The flag is intentionally not part
 * of `SAFE_BETA_FLAGS`: that registry requires every entry to be explicitly
 * present in deployment environments, and B4 has no deployment. Keeping the
 * gate self-contained means adding it cannot weaken or block an existing
 * deployment preflight.
 */
export function inspectPlannerGate(
  environment: PlannerEnvironment,
): PlannerGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment.AGENT_PLANNING_ORCHESTRATION_ENABLED !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isPlannerEnabled(
  environment: PlannerEnvironment = process.env,
): boolean {
  return inspectPlannerGate(environment).enabled;
}

export function plannerGateLabel(gate: PlannerGate): string {
  switch (gate.reason) {
    case "enabled":
      return "Enabled for non-production mock contracts";
    case "production":
      return "Hard-off in production";
    default:
      return "Disabled (default)";
  }
}
