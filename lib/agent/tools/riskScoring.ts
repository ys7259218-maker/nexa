/**
 * Phase B B3 risk scoring.
 *
 * Risk classification = data_sensitivity × side_effect × blast_radius,
 * scored per step. Each dimension is scored 1-5. The matrix score elevates
 * the effective tier but never lowers it: effectiveTier = max(declaredTier,
 * riskTier).
 */

import {
  PERMISSION_TIERS,
  RISK_DIMENSION_MAX,
  type PermissionTier,
  tierIndex,
  type RiskScore,
  isValidRiskDimension,
} from "./permissionTypes.ts";

const TIER_FROM_RISK_SCORE: Readonly<Record<number, PermissionTier>> = {
  // 1-3: minimal risk, no elevation
  1: "T0",
  2: "T0",
  3: "T0",
  // 4-6: low, no elevation beyond T1
  4: "T1",
  5: "T1",
  6: "T1",
  // 7-9: medium, elevate to T2
  7: "T2",
  8: "T2",
  9: "T2",
  // 10-12: high, elevate to T3
  10: "T3",
  11: "T3",
  12: "T3",
  // 13-15: critical, elevate to T4
  13: "T4",
  14: "T4",
  15: "T4",
};

const MAX_RISK_SCORE =
  RISK_DIMENSION_MAX * RISK_DIMENSION_MAX * RISK_DIMENSION_MAX;

/**
 * Score a step's risk across three dimensions, each 1-5. Returns a risk
 * score object whose effectiveTier is always >= the declared tier.
 *
 * The product dataSensitivity × sideEffect × blastRadius maps to a base
 * risk tier via the reviewed matrix. The effective tier is max(declared,
 * riskBase), so risk scoring never lowers a tier.
 */
export function scoreRisk(
  declaredTier: PermissionTier,
  dataSensitivity: number,
  sideEffect: number,
  blastRadius: number,
): RiskScore {
  if (!isValidRiskDimension(dataSensitivity)) {
    throw new Error(`data_sensitivity must be ${1}-${5}`);
  }
  if (!isValidRiskDimension(sideEffect)) {
    throw new Error(`side_effect must be ${1}-${5}`);
  }
  if (!isValidRiskDimension(blastRadius)) {
    throw new Error(`blast_radius must be ${1}-${5}`);
  }

  const product = dataSensitivity * sideEffect * blastRadius;
  const clamped = Math.min(product, MAX_RISK_SCORE);
  const riskBase = TIER_FROM_RISK_SCORE[clamped] ?? "T4";

  const declaredIndex = tierIndex(declaredTier);
  const riskIndex = tierIndex(riskBase);
  const effectiveIndex = Math.max(declaredIndex, riskIndex);
  const effectiveTier = PERMISSION_TIERS[effectiveIndex];

  return {
    dataSensitivity,
    sideEffect,
    blastRadius,
    effectiveTier,
  };
}

/**
 * Return the base risk tier implied by the product score, without applying
 * the declared tier floor. Used for testing the matrix in isolation.
 */
export function riskBaseTier(
  dataSensitivity: number,
  sideEffect: number,
  blastRadius: number,
): PermissionTier {
  if (!isValidRiskDimension(dataSensitivity)) {
    throw new Error(`data_sensitivity must be ${1}-${5}`);
  }
  if (!isValidRiskDimension(sideEffect)) {
    throw new Error(`side_effect must be ${1}-${5}`);
  }
  if (!isValidRiskDimension(blastRadius)) {
    throw new Error(`blast_radius must be ${1}-${5}`);
  }

  const product = dataSensitivity * sideEffect * blastRadius;
  const clamped = Math.min(product, MAX_RISK_SCORE);
  return TIER_FROM_RISK_SCORE[clamped] ?? "T4";
}

export { MAX_RISK_SCORE };
