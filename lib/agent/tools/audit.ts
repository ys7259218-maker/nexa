import { randomUUID } from "node:crypto";

import {
  isToolErrorClass,
  isToolTimeoutClass,
  type ToolErrorClass,
  type ToolInvocationStatus,
  type ToolTimeoutClass,
} from "./types.ts";

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$/;
const TOOL_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const INVOCATION_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;

export type ToolInvocationAuditInput = {
  workspaceId: string;
  taskId: string | null;
  stepId: string | null;
  invocationKey: string;
  toolName: string;
  toolVersion: string;
  manifestHash: string;
  timeoutClass: ToolTimeoutClass;
  argsHash: string;
  outputHash: string | null;
  status: ToolInvocationStatus;
  errorClass: ToolErrorClass | null;
  attempt: number;
  durationMs: number;
};

export type ToolInvocationAudit = ToolInvocationAuditInput & {
  id: string;
  createdAt: string;
  completedAt: string;
};

export type ToolAuditRecordOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: string };

export interface ToolInvocationAuditStore {
  record(input: ToolInvocationAuditInput): Promise<ToolAuditRecordOutcome>;
  list(workspaceId: string, limit?: number): Promise<ToolInvocationAudit[]>;
}

export type InMemoryToolAuditStore = ToolInvocationAuditStore & {
  snapshot(): ToolInvocationAudit[];
};

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validateInput(input: ToolInvocationAuditInput): string | null {
  if (!isNonEmptyText(input.workspaceId)) return "invalid_workspace";
  if (input.taskId !== null && !isNonEmptyText(input.taskId)) return "invalid_task";
  if (input.stepId !== null && !isNonEmptyText(input.stepId)) return "invalid_step";
  if (!INVOCATION_KEY_PATTERN.test(input.invocationKey)) return "invalid_invocation_key";
  if (!TOOL_NAME_PATTERN.test(input.toolName)) return "invalid_tool_name";
  if (!TOOL_VERSION_PATTERN.test(input.toolVersion)) return "invalid_tool_version";
  if (!HASH_PATTERN.test(input.manifestHash)) return "invalid_manifest_hash";
  if (!isToolTimeoutClass(input.timeoutClass)) return "invalid_timeout_class";
  if (!HASH_PATTERN.test(input.argsHash)) return "invalid_args_hash";
  if (input.outputHash !== null && !HASH_PATTERN.test(input.outputHash)) {
    return "invalid_output_hash";
  }
  if (input.status !== "SUCCEEDED" && input.status !== "FAILED") {
    return "invalid_status";
  }
  if (input.errorClass !== null && !isToolErrorClass(input.errorClass)) {
    return "invalid_error_class";
  }
  if (
    (input.status === "SUCCEEDED" &&
      (input.errorClass !== null || input.outputHash === null)) ||
    (input.status === "FAILED" &&
      (input.errorClass === null || input.outputHash !== null))
  ) {
    return "invalid_outcome";
  }
  if (!Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt > 3) {
    return "invalid_attempt";
  }
  if (
    !Number.isInteger(input.durationMs) ||
    input.durationMs < 0 ||
    input.durationMs > 600_000
  ) {
    return "invalid_duration";
  }
  return null;
}

function cloneAudit(row: ToolInvocationAudit): ToolInvocationAudit {
  return { ...row };
}

export function createInMemoryToolAuditStore(
  options: {
    now?: () => Date;
    idFactory?: () => string;
  } = {},
): InMemoryToolAuditStore {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());
  const rows = new Map<string, ToolInvocationAudit>();
  const keys = new Set<string>();

  return {
    async record(input) {
      const invalid = validateInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const key = `${input.workspaceId}:${input.invocationKey}:${input.attempt}`;
      if (keys.has(key)) {
        return { ok: false, reason: "duplicate_invocation" };
      }
      keys.add(key);

      const timestamp = now().toISOString();
      const row: ToolInvocationAudit = {
        ...input,
        id: idFactory(),
        createdAt: timestamp,
        completedAt: timestamp,
      };
      rows.set(row.id, row);
      return { ok: true, id: row.id };
    },

    async list(workspaceId, limit = 100) {
      const bounded = Math.min(500, Math.max(1, Math.floor(limit)));
      return [...rows.values()]
        .filter((row) => row.workspaceId === workspaceId)
        .sort((left, right) => {
          const byTime = left.createdAt.localeCompare(right.createdAt);
          return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
        })
        .slice(0, bounded)
        .map(cloneAudit);
    },

    snapshot() {
      return [...rows.values()].map(cloneAudit);
    },
  };
}
