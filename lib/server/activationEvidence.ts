import { buildActivationChecklist, isActivationReady, type ActivationCheck } from "../employeeActivation.ts";
import type { AIEmployee } from "../aiEmployees.ts";

export type EvidenceState = "missing" | "stale" | "incomplete" | "fresh";

export type ActivationEvidenceInsert = {
  ai_employee_id: string;
  workspace_id: string;
  channel_linked: boolean;
  webhook_configured: boolean;
  inbound_ready: boolean;
  outbound_enabled: boolean;
  verified_at: string;
  verified_by: string;
};

export type StoredActivationEvidence = ActivationEvidenceInsert;

export type EvidenceWriter = {
  readEvidence(employeeId: string): Promise<{ row: StoredActivationEvidence | null; error: string | null }>;
  writeEvidence(row: ActivationEvidenceInsert): Promise<{ error: string | null }>;
};

export const EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWellFormedUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function classifyEvidence(
  evidence: StoredActivationEvidence | null,
  now: Date = new Date(),
): { state: EvidenceState; verifiedAt: string | null } {
  if (!evidence) return { state: "missing", verifiedAt: null };
  const verifiedMs = Date.parse(evidence.verified_at);
  if (Number.isNaN(verifiedMs)) return { state: "missing", verifiedAt: evidence.verified_at };
  if (now.getTime() - verifiedMs > EVIDENCE_TTL_MS) return { state: "stale", verifiedAt: evidence.verified_at };
  const complete =
    evidence.channel_linked &&
    evidence.webhook_configured &&
    evidence.inbound_ready &&
    evidence.outbound_enabled;
  return { state: complete ? "fresh" : "incomplete", verifiedAt: evidence.verified_at };
}

export type ServerVerifiedChannelState = {
  linked: boolean;
  webhookConfigured: boolean;
  inboundReady: boolean;
  outboundEnabled: boolean;
};

export function buildActivationEvidenceRow(input: {
  aiEmployeeId: string;
  workspaceId: string;
  channel: ServerVerifiedChannelState;
  verifiedBy: string;
  verifiedAt: string;
}): ActivationEvidenceInsert {
  return {
    ai_employee_id: input.aiEmployeeId,
    workspace_id: input.workspaceId,
    channel_linked: input.channel.linked,
    webhook_configured: input.channel.webhookConfigured,
    inbound_ready: input.channel.inboundReady,
    outbound_enabled: input.channel.outboundEnabled,
    verified_at: input.verifiedAt,
    verified_by: input.verifiedBy,
  };
}

export type ActivationAuthorization =
  | "ok"
  | "unauthenticated"
  | "invalid-target"
  | "not-found"
  | "unauthorized-actor";

export function authorizeActivationVerification(input: {
  actor: { id: string } | null | undefined;
  employeeId: string;
  employee: AIEmployee | null;
}): ActivationAuthorization {
  if (!input.actor?.id) return "unauthenticated";
  if (!isWellFormedUuid(input.actor.id)) return "unauthorized-actor";
  if (!isWellFormedUuid(input.employeeId)) return "invalid-target";
  // The employee must be visible to the authenticated actor. Server routes
  // fetch it through the actor's own RLS-scoped session, so a cross-account
  // or missing employee yields null here.
  if (!input.employee || input.employee.id !== input.employeeId) return "not-found";
  return "ok";
}

export type ActivationVerificationInput = {
  actor: { id: string } | null | undefined;
  employeeId: string;
  employee: AIEmployee | null;
  workspaceId: string;
  channel: ServerVerifiedChannelState;
  verifiedBy: string;
  writer: EvidenceWriter;
  now?: Date;
};

export type ActivationVerificationResult = {
  employeeId: string;
  checks: ActivationCheck[];
  allReady: boolean;
  activationReady: boolean;
  evidenceState: EvidenceState;
  verifiedAt: string | null;
};

export type ActivationVerificationResponse =
  | { ok: true; result: ActivationVerificationResult }
  | { ok: false; error: ActivationAuthorization | "verifier-unavailable" };

export async function verifyActivationEvidence(
  input: ActivationVerificationInput,
): Promise<ActivationVerificationResponse> {
  const authorization = authorizeActivationVerification({
    actor: input.actor,
    employeeId: input.employeeId,
    employee: input.employee,
  });
  if (authorization !== "ok") return { ok: false, error: authorization };
  if (!isWellFormedUuid(input.workspaceId)) return { ok: false, error: "invalid-target" };
  if (!isWellFormedUuid(input.verifiedBy)) return { ok: false, error: "unauthorized-actor" };

  const now = input.now ?? new Date();
  const checks = buildActivationChecklist(input.employee!, input.channel);
  const allReady = isActivationReady(checks);

  const complete =
    input.channel.linked &&
    input.channel.webhookConfigured &&
    input.channel.inboundReady &&
    input.channel.outboundEnabled;

  const row = buildActivationEvidenceRow({
    aiEmployeeId: input.employeeId,
    workspaceId: input.workspaceId,
    channel: input.channel,
    verifiedBy: input.verifiedBy,
    verifiedAt: now.toISOString(),
  });

  const write = await input.writer.writeEvidence(row);

  if (write.error) {
    // Fail closed: a failed write must never unlock activation. Report the
    // previously stored evidence so stale/missing state stays visible.
    const existing = await input.writer.readEvidence(input.employeeId);
    const classified = classifyEvidence(existing.error ? null : existing.row, now);
    return {
      ok: true,
      result: {
        employeeId: input.employeeId,
        checks,
        allReady,
        activationReady: false,
        evidenceState: classified.state,
        verifiedAt: classified.verifiedAt,
      },
    };
  }

  return {
    ok: true,
    result: {
      employeeId: input.employeeId,
      checks,
      allReady,
      activationReady: allReady && complete,
      // The row was just rewritten, so freshness is guaranteed by construction.
      // If the server-evaluated channel state is incomplete (e.g. outbound is
      // still disabled), the evidence is recorded as incomplete and locks.
      evidenceState: complete ? "fresh" : "incomplete",
      verifiedAt: row.verified_at,
    },
  };
}