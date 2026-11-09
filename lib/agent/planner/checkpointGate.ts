/**
 * Phase B B4 checkpoint gate.
 *
 * Pre-execution checkpoint for every plan step: calls B3 authorize()
 * before a step can execute. If CHALLENGE → step blocked, approval
 * required via B3 agent_approval_requests. If DENY → step marked failed,
 * alarm recorded. Checkpoint recorded in agent_plan_checkpoints with
 * content-free decision hash.
 */

import { hashJsonSafe } from "../tools/hash.ts";
import type {
  PlannerOptions,
  PlanCheckpointDecision,
  PlanStep,
} from "./plannerTypes.ts";

/**
 * Run a pre-execution checkpoint for a plan step through B3 authorize().
 * Returns the checkpoint decision and whether execution is permitted.
 *
 * Content-free: only ids and hashes cross the boundary to authorize().
 */
export async function runPreExecutionCheckpoint(
  planStep: PlanStep,
  options: PlannerOptions,
): Promise<{
  decision: PlanCheckpointDecision;
  requiresApproval: boolean;
  permitted: boolean;
  decisionHash: string;
  effectiveTier: string;
  ttlSeconds: number | null;
}> {
  const now = options.now ?? (() => new Date());
  const nowTime = now();

  const result = await options.authorizeStep(
    planStep.planId, // workspaceId is derived from plan in B3; here we pass planId as context
    planStep.declaredTier,
    planStep.toolFamily,
    planStep.riskScore,
    nowTime,
  );

  const decisionHash = hashJsonSafe({
    planStepId: planStep.id,
    planId: planStep.planId,
    tier: planStep.declaredTier,
    toolFamily: planStep.toolFamily,
    decision: result.decision,
    effectiveTier: result.effectiveTier,
  });

  await options.recordCheckpoint(
    planStep.id,
    "pre_execution",
    result.decision,
    decisionHash,
  );

  const permitted = result.decision === "ALLOW";
  const requiresApproval = result.requiresApproval;

  return {
    decision: result.decision,
    requiresApproval,
    permitted,
    decisionHash,
    effectiveTier: result.effectiveTier,
    ttlSeconds: result.ttlSeconds,
  };
}

export type { PlannerOptions };
