/**
 * Phase B B5 memory system kill switch.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in any
 * production build or production Vercel environment, so a copied flag cannot
 * activate the memory system in production.
 */

export type MemoryEnvironment = Readonly<Record<string, string | undefined>>;

export type MemoryGateReason = "enabled" | "flag_off" | "production";

export type MemoryGate = {
  enabled: boolean;
  reason: MemoryGateReason;
};

/**
 * B5 kill switch. Hard-off in production. The flag is intentionally not part
 * of `SAFE_BETA_FLAGS`: that registry requires every entry to be explicitly
 * present in deployment environments, and B5 has no deployment. Keeping the
 * gate self-contained means adding it cannot weaken or block an existing
 * deployment preflight.
 */
export function inspectMemoryGate(
  environment: MemoryEnvironment,
): MemoryGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment.AGENT_MEMORY_SYSTEM_ENABLED !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

export function isMemorySystemEnabled(
  environment: MemoryEnvironment = process.env,
): boolean {
  return inspectMemoryGate(environment).enabled;
}

export function memoryGateLabel(gate: MemoryGate): string {
  switch (gate.reason) {
    case "enabled":
      return "Enabled for non-production mock contracts";
    case "production":
      return "Hard-off in production";
    default:
      return "Disabled (default)";
  }
}
