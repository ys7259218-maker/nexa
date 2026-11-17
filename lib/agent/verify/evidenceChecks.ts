/**
 * Phase B B8 VERIFYING evidence checker (matrix VE-01 … VE-06, scope C4).
 *
 * Pure and content-free: it inspects only ids, states, counts and statuses the
 * caller already read. It performs no read itself and returns only failure
 * codes plus a hash, never page, argument or output content. A caller must
 * fail closed on any failure, including an unexpected error.
 */

import { hashJson } from "../tools/hash.ts";
import type { ToolInvocationAudit } from "../tools/audit.ts";
import type { AgentEvent, AgentTask, AgentTaskStep } from "../types.ts";
import type { AgentVerifyEvidenceHook } from "../runtime.ts";
import type { AgentTaskStore } from "../store.ts";

export const VERIFY_EVIDENCE_FAILURES = [
  "invalid_input",
  "not_verifying",
  "missing_terminal_event",
  "missing_step_event",
  "missing_audit_row",
  "open_approval",
  "cross_workspace_evidence",
] as const;

export type VerifyEvidenceFailure = (typeof VERIFY_EVIDENCE_FAILURES)[number];

/** Tools whose step must carry its own audit row before COMPLETE. */
export const DEFAULT_SIDE_EFFECTING_TOOL_NAMES: readonly string[] = [
  "browser.act",
];

export type VerifyEvidenceApproval = Readonly<{
  workspaceId: string;
  status: string;
}>;

export type VerifyEvidenceInput = Readonly<{
  task: Pick<AgentTask, "id" | "workspaceId" | "state">;
  steps: readonly AgentTaskStep[];
  events: readonly AgentEvent[];
  audits: readonly ToolInvocationAudit[];
  openApprovals: readonly VerifyEvidenceApproval[];
  sideEffectingToolNames?: readonly string[];
}>;

export type VerifyEvidenceCheck = Readonly<{
  ok: boolean;
  failures: readonly VerifyEvidenceFailure[];
  evidenceHash: string;
}>;

function uniqueSorted(
  failures: readonly VerifyEvidenceFailure[],
): readonly VerifyEvidenceFailure[] {
  return Object.freeze([...new Set(failures)].sort());
}

export function checkVerifyEvidence(
  input: VerifyEvidenceInput,
): VerifyEvidenceCheck {
  const failures: VerifyEvidenceFailure[] = [];
  const task = input.task;

  if (
    !task ||
    typeof task.id !== "string" ||
    typeof task.workspaceId !== "string" ||
    !Array.isArray(input.steps) ||
    !Array.isArray(input.events) ||
    !Array.isArray(input.audits) ||
    !Array.isArray(input.openApprovals)
  ) {
    return Object.freeze({
      ok: false,
      failures: uniqueSorted(["invalid_input"]),
      evidenceHash: hashJson({ valid: false }),
    });
  }

  if (task.state !== "VERIFYING") {
    failures.push("not_verifying");
  }

  const stepIds = new Set(input.steps.map((step) => step.id));

  if (
    input.steps.some((step) => step.workspaceId !== task.workspaceId) ||
    input.audits.some((audit) => audit.workspaceId !== task.workspaceId) ||
    input.openApprovals.some(
      (approval) => approval.workspaceId !== task.workspaceId,
    )
  ) {
    failures.push("cross_workspace_evidence");
  }

  const succeededStepIds = new Set(
    input.steps
      .filter((step) => step.status === "SUCCEEDED")
      .map((step) => step.id),
  );

  const terminalEvent = input.events.some(
    (event) =>
      event.taskId === task.id &&
      event.workspaceId === task.workspaceId &&
      event.type === "task_completed",
  );
  if (!terminalEvent) {
    failures.push("missing_terminal_event");
  }

  const stepEventIds = new Set(
    input.events
      .filter(
        (event) =>
          event.taskId === task.id &&
          event.workspaceId === task.workspaceId &&
          event.type === "step_succeeded" &&
          typeof event.payload.step_id === "string",
      )
      .map((event) => String(event.payload.step_id)),
  );
  for (const stepId of succeededStepIds) {
    if (!stepEventIds.has(stepId)) failures.push("missing_step_event");
  }

  const sideEffecting = new Set(
    input.sideEffectingToolNames ?? DEFAULT_SIDE_EFFECTING_TOOL_NAMES,
  );
  const auditedStepIds = new Set(
    input.audits
      .filter((audit) => audit.status === "SUCCEEDED" && audit.stepId !== null)
      .map((audit) => String(audit.stepId)),
  );
  for (const step of input.steps) {
    const needsAudit =
      step.status === "SUCCEEDED" && sideEffecting.has(step.toolName);
    if (needsAudit && !auditedStepIds.has(step.id)) {
      failures.push("missing_audit_row");
    }
  }

  for (const approval of input.openApprovals) {
    if (approval.status === "pending") failures.push("open_approval");
  }

  const sorted = uniqueSorted(failures);
  return Object.freeze({
    ok: sorted.length === 0,
    failures: sorted,
    evidenceHash: hashJson({
      taskId: task.id,
      workspaceId: task.workspaceId,
      stepCount: input.steps.length,
      succeededSteps: succeededStepIds.size,
      eventCount: input.events.length,
      auditCount: input.audits.length,
      stepIds: [...stepIds].sort(),
      failures: sorted,
    }),
  });
}

export type VerifyEvidenceReader = (context: {
  task: AgentTask;
  store: AgentTaskStore;
}) => Promise<VerifyEvidenceInput>;

/**
 * Adapter from the pure checker to the optional runtime hook. Any reader or
 * checker error is reported as a failure so the runtime transitions to FAILED
 * and never to COMPLETE.
 */
export function createVerifyEvidenceHook(
  reader: VerifyEvidenceReader,
): AgentVerifyEvidenceHook {
  return async (context) => {
    try {
      const check = checkVerifyEvidence(await reader(context));
      if (check.ok) return { ok: true };
      return {
        ok: false,
        reason: check.failures[0] ?? "evidence_check_failed",
      };
    } catch {
      return { ok: false, reason: "evidence_check_error" };
    }
  };
}
