import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ToolAuditRecordOutcome,
  ToolInvocationAudit,
  ToolInvocationAuditInput,
} from "./audit.ts";
import type {
  ToolManifestRecord,
  ToolManifestStore,
} from "./registry.ts";
import {
  isToolErrorClass,
  isToolTimeoutClass,
  type ToolInvocationStatus,
} from "./types.ts";

/**
 * Service-role adapter for the B2 tool tables. Every write maps a reviewed
 * SECURITY DEFINER RPC; no method coerces an RPC error into success. This
 * module is server-only and is not wired to any deployment in B2.
 */

type RpcRow = Record<string, unknown>;

export type ToolManifestRow = {
  id?: unknown;
  workspace_id?: unknown;
  tool_name?: unknown;
  tool_version?: unknown;
  manifest?: unknown;
  manifest_hash?: unknown;
  enabled?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type ToolInvocationRow = {
  id?: unknown;
  workspace_id?: unknown;
  task_id?: unknown;
  step_id?: unknown;
  invocation_key?: unknown;
  tool_name?: unknown;
  tool_version?: unknown;
  manifest_hash?: unknown;
  timeout_class?: unknown;
  args_hash?: unknown;
  output_hash?: unknown;
  status?: unknown;
  error_class?: unknown;
  attempt?: unknown;
  duration_ms?: unknown;
  created_at?: unknown;
  completed_at?: unknown;
};

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function firstRow(data: unknown): RpcRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  return isRecord(data[0]) ? data[0] : null;
}

export function mapToolManifestRow(
  row: ToolManifestRow | null | undefined,
): ToolManifestRecord | null {
  if (!row) return null;
  const toolName = asText(row.tool_name);
  const toolVersion = asText(row.tool_version);
  const manifestHash = asText(row.manifest_hash);
  if (
    !toolName ||
    !toolVersion ||
    !isRecord(row.manifest) ||
    !manifestHash ||
    !HASH_PATTERN.test(manifestHash) ||
    typeof row.enabled !== "boolean"
  ) {
    return null;
  }
  return {
    toolName,
    toolVersion,
    manifest: row.manifest,
    manifestHash,
    enabled: row.enabled,
  };
}

export function mapToolInvocationRow(
  row: ToolInvocationRow | null | undefined,
): ToolInvocationAudit | null {
  if (!row) return null;
  const id = asText(row.id);
  const workspaceId = asText(row.workspace_id);
  const invocationKey = asText(row.invocation_key);
  const toolName = asText(row.tool_name);
  const toolVersion = asText(row.tool_version);
  const manifestHash = asText(row.manifest_hash);
  const argsHash = asText(row.args_hash);
  const outputHash = row.output_hash === null ? null : asText(row.output_hash);
  const status = row.status;
  const errorClass = row.error_class === null ? null : row.error_class;
  const timeoutClass = row.timeout_class;
  const taskId = row.task_id === null ? null : asText(row.task_id);
  const stepId = row.step_id === null ? null : asText(row.step_id);
  const attempt = asInteger(row.attempt);
  const durationMs = asInteger(row.duration_ms);
  const createdAt = asIso(row.created_at);
  const completedAt = asIso(row.completed_at);

  if (
    !id ||
    !workspaceId ||
    !invocationKey ||
    !toolName ||
    !toolVersion ||
    !manifestHash ||
    !HASH_PATTERN.test(manifestHash) ||
    !argsHash ||
    !HASH_PATTERN.test(argsHash) ||
    (outputHash !== null && !HASH_PATTERN.test(outputHash)) ||
    (status !== "SUCCEEDED" && status !== "FAILED") ||
    (errorClass !== null && !isToolErrorClass(errorClass)) ||
    !isToolTimeoutClass(timeoutClass) ||
    (row.task_id !== null && taskId === null) ||
    (row.step_id !== null && stepId === null) ||
    attempt === null ||
    attempt < 1 ||
    attempt > 3 ||
    durationMs === null ||
    durationMs < 0 ||
    durationMs > 600_000 ||
    !createdAt ||
    !completedAt
  ) {
    return null;
  }

  const invocationStatus = status as ToolInvocationStatus;
  const normalizedErrorClass =
    errorClass === null ? null : (errorClass as ToolInvocationAudit["errorClass"]);
  if (
    (invocationStatus === "SUCCEEDED" &&
      (errorClass !== null || outputHash === null)) ||
    (invocationStatus === "FAILED" &&
      (errorClass === null || outputHash !== null))
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    taskId,
    stepId,
    invocationKey,
    toolName,
    toolVersion,
    manifestHash,
    timeoutClass,
    argsHash,
    outputHash,
    status: invocationStatus,
    errorClass: normalizedErrorClass,
    attempt,
    durationMs,
    createdAt,
    completedAt,
  };
}

export type SupabaseToolStore = ToolManifestStore & {
  upsertManifest(input: {
    workspaceId: string;
    toolName: string;
    toolVersion: string;
    manifest: unknown;
    manifestHash: string;
    createdBy?: string | null;
  }): Promise<{ ok: true; id: string } | { ok: false; reason: string }>;
  recordInvocation(
    input: ToolInvocationAuditInput,
  ): Promise<ToolAuditRecordOutcome>;
  listInvocations(
    workspaceId: string,
    limit?: number,
  ): Promise<ToolInvocationAudit[]>;
};

export function createSupabaseToolStore(
  service: SupabaseClient,
): SupabaseToolStore {
  return {
    async listManifests(workspaceId) {
      const result = await service
        .from("agent_tool_manifests")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("tool_name", { ascending: true });
      if (result.error || !Array.isArray(result.data)) return null;
      const mapped = result.data.map((row) =>
        mapToolManifestRow(row as ToolManifestRow),
      );
      if (mapped.some((row) => row === null)) return null;
      return mapped as ToolManifestRecord[];
    },

    async upsertManifest(input) {
      const result = await service.rpc("upsert_agent_tool_manifest", {
        p_workspace_id: input.workspaceId,
        p_tool_name: input.toolName,
        p_tool_version: input.toolVersion,
        p_manifest: input.manifest,
        p_manifest_hash: input.manifestHash,
        p_created_by: input.createdBy ?? null,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.manifest_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, id };
    },

    async recordInvocation(input) {
      const result = await service.rpc("record_agent_tool_invocation", {
        p_workspace_id: input.workspaceId,
        p_invocation_key: input.invocationKey,
        p_tool_name: input.toolName,
        p_tool_version: input.toolVersion,
        p_manifest_hash: input.manifestHash,
        p_timeout_class: input.timeoutClass,
        p_args_hash: input.argsHash,
        p_status: input.status,
        p_error_class: input.errorClass,
        p_attempt: input.attempt,
        p_duration_ms: input.durationMs,
        p_output_hash: input.outputHash,
        p_task_id: input.taskId,
        p_step_id: input.stepId,
      });
      if (result.error) return { ok: false, reason: "record_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.invocation_id) : null;
      if (reason !== "recorded" || !id) {
        return { ok: false, reason: reason ?? "record_rejected" };
      }
      return { ok: true, id };
    },

    async listInvocations(workspaceId, limit = 100) {
      const bounded = Math.min(500, Math.max(1, Math.floor(limit)));
      const result = await service
        .from("agent_tool_invocations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(bounded);
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapToolInvocationRow(row as ToolInvocationRow))
        .filter((row): row is ToolInvocationAudit => row !== null);
    },
  };
}
