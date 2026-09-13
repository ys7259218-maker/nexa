import { inspectClosedBetaEnvironment, type DeployEnvironment } from "./deployPreflight.ts";

/**
 * Vercel production-build gate. Vercel sets VERCEL_ENV to "production" only for
 * deployments to the configured production environment, while preview deployments
 * and local/CI builds leave it unset (or "preview"/"development"). GitHub merges
 * to main therefore trigger a Vercel production build whose `next build` fails
 * closed here until an explicit, reviewed production-readiness signal is present.
 *
 * Nothing here is a secret and no value is ever printed: the guard reports only
 * environment-variable NAMES and rule explanations.
 */
export const PRODUCTION_READINESS_VARIABLE = "PRODUCTION_RELEASE_APPROVED";

/**
 * The exact non-secret signal an operator must place in the Vercel production
 * environment AFTER Codex security review and Human Owner release approval. It
 * is a deliberate yes/no switch, not a credential, and is documented in
 * docs/OPERATIONS_RUNBOOK.md.
 */
export const REVIEWED_READINESS_SIGNAL = "nexa-production-approved-v1";

/**
 * The exact staging Supabase project reference as recorded in NEXA_HANDOFF.md
 * ("`nexa-beryl-gamma` serves staging (`vbizuxxgjlwqotuegskq`)"). Supabase
 * project URLs are `https://<ref>.supabase.co`, so the staging hostname is
 * matched by exact, normalized equality: a production build pointed at the
 * staging project is rejected even when a reviewed-readiness signal is present,
 * while an unrelated ref that merely shares a short prefix is never mistaken
 * for staging.
 */
const STAGING_SUPABASE_HOST = "vbizuxxgjlwqotuegskq.supabase.co";

function valueOf(environment: DeployEnvironment, name: string): string {
  return environment[name]?.trim() ?? "";
}

export function isVercelProductionBuild(environment: DeployEnvironment): boolean {
  return valueOf(environment, "VERCEL_ENV") === "production";
}

export function hasReviewedReadinessSignal(environment: DeployEnvironment): boolean {
  const value = valueOf(environment, PRODUCTION_READINESS_VARIABLE);
  if (value !== REVIEWED_READINESS_SIGNAL) return false;
  // Guard against a residual blank-signal build: the value must also pass the
  // pattern the runbook documents for manual verification.
  return value.length === REVIEWED_READINESS_SIGNAL.length;
}

export function isStagingSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase() === STAGING_SUPABASE_HOST;
  } catch {
    return false;
  }
}

/**
 * Inspects the build environment. Non-production contexts (preview, local, CI)
 * return no issues so those builds stay usable. Production contexts additionally
 * re-use the strict closed-beta preflight unchanged (which enforces
 * WHATSAPP_OUTBOUND_ENABLED=false among the rollout flags), require the explicit
 * reviewed-readiness signal, and reject the staging Supabase project.
 */
export function inspectProductionBuild(environment: DeployEnvironment): string[] {
  if (!isVercelProductionBuild(environment)) return [];

  const issues: string[] = [];

  if (!hasReviewedReadinessSignal(environment)) {
    issues.push(
      `${PRODUCTION_READINESS_VARIABLE} must be set to the documented reviewed-readiness signal after Codex/Human release review.`,
    );
  }

  const supabaseUrl = valueOf(environment, "NEXT_PUBLIC_SUPABASE_URL");
  if (isStagingSupabaseUrl(supabaseUrl)) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_URL must not reference the staging Supabase project for a production build.",
    );
  }

  issues.push(...inspectClosedBetaEnvironment(environment));

  return issues;
}