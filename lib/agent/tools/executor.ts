import type { ToolInvocationAuditStore } from "./audit.ts";
import { classifyToolError, ToolError } from "./errors.ts";
import { hashJsonSafe } from "./hash.ts";
import type { ToolRegistry } from "./registry.ts";
import { validateToolInput, validateToolOutput } from "./schema.ts";
import {
  TOOL_TIMEOUT_POLICY,
  toolAdapterKey,
  type ToolAdapter,
  type ToolAdapters,
  type ToolErrorClass,
  type ToolErrorShape,
  type ToolManifest,
  type ToolTimeoutClass,
} from "./types.ts";

const INVOCATION_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;
const MAX_DURATION_MS = 600_000;

export type ToolExecutionRequest = {
  workspaceId: string;
  invocationKey: string;
  toolName: string;
  toolVersion: string;
  input: unknown;
  taskId?: string | null;
  stepId?: string | null;
};

export type ToolExecutionResult =
  | {
      ok: true;
      output: Record<string, unknown>;
      attempts: number;
      auditIds: string[];
    }
  | {
      ok: false;
      errorClass: ToolErrorClass;
      code: string;
      attempts: number;
      auditIds: string[];
    };

export type ToolExecutorOptions = {
  registry: ToolRegistry;
  adapters: ToolAdapters;
  auditStore: ToolInvocationAuditStore;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  /**
   * Test-only timeout override. Values are clamped to the reviewed class
   * timeout; production callers omit this and get the exact class policy.
   */
  timeoutMsByClass?: Partial<Record<ToolTimeoutClass, number>>;
};

type AdapterOutcome =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "timeout" };

function defaultSleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runWithTimeout(
  adapter: ToolAdapter,
  input: Record<string, unknown>,
  context: Parameters<ToolAdapter>[1],
  timeoutMs: number,
): Promise<AdapterOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AdapterOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs);
  });

  try {
    return await Promise.race([
      adapter(input, context).then((value) => ({ ok: true as const, value })),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function durationMs(startedAt: number, finishedAt: number): number {
  return Math.min(
    MAX_DURATION_MS,
    Math.max(0, Math.round(finishedAt - startedAt)),
  );
}

function timeoutFor(
  manifest: ToolManifest,
  overrides: Partial<Record<ToolTimeoutClass, number>> | undefined,
): number {
  const policy = TOOL_TIMEOUT_POLICY[manifest.timeoutClass];
  const override = overrides?.[manifest.timeoutClass];
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    override > 0 &&
    override <= policy.timeoutMs
  ) {
    return Math.floor(override);
  }
  return policy.timeoutMs;
}

function optionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function invalidResult(code: string): ToolExecutionResult {
  return {
    ok: false,
    errorClass: "VALIDATION",
    code,
    attempts: 0,
    auditIds: [],
  };
}

/**
 * Execute exactly one reviewed tool invocation. The executor never calls a
 * network, filesystem, provider, WhatsApp, calendar, browser, or computer-use
 * API; all effects are behind the injected adapter contract. Every registered
 * invocation attempt, including validation failures, produces one append-only
 * audit row with hashes only.
 */
export async function executeToolInvocation(
  options: ToolExecutorOptions,
  request: ToolExecutionRequest,
): Promise<ToolExecutionResult> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;

  if (typeof request.workspaceId !== "string" || request.workspaceId.length === 0) {
    return invalidResult("invalid_workspace");
  }
  if (
    typeof request.invocationKey !== "string" ||
    !INVOCATION_KEY_PATTERN.test(request.invocationKey)
  ) {
    return invalidResult("invalid_invocation_key");
  }

  const taskId = optionalId(request.taskId);
  const stepId = optionalId(request.stepId);
  if (taskId === undefined) return invalidResult("invalid_task_id");
  if (stepId === undefined) return invalidResult("invalid_step_id");

  const manifest = options.registry.get(request.toolName, request.toolVersion);
  if (!manifest) {
    return invalidResult("manifest_missing");
  }

  const manifestHash = options.registry.hashFor(
    request.toolName,
    request.toolVersion,
  );
  if (!manifestHash) {
    return invalidResult("manifest_hash_missing");
  }

  const argsHash = hashJsonSafe(request.input);
  const auditIds: string[] = [];
  const baseAudit = {
    workspaceId: request.workspaceId,
    taskId,
    stepId,
    invocationKey: request.invocationKey,
    toolName: manifest.name,
    toolVersion: manifest.version,
    manifestHash,
    timeoutClass: manifest.timeoutClass,
  };

  const inputErrors = validateToolInput(manifest, request.input);
  if (inputErrors.length > 0) {
    const recorded = await options.auditStore.record({
      ...baseAudit,
      argsHash,
      outputHash: null,
      status: "FAILED",
      errorClass: "VALIDATION",
      attempt: 1,
      durationMs: 0,
    });
    if (!recorded.ok) {
      return {
        ok: false,
        errorClass: "INTERNAL",
        code: "audit_write_failed",
        attempts: 1,
        auditIds,
      };
    }
    return {
      ok: false,
      errorClass: "VALIDATION",
      code: "input_invalid",
      attempts: 1,
      auditIds: [recorded.id],
    };
  }

  const adapter = options.adapters[
    toolAdapterKey(manifest.name, manifest.version)
  ];
  if (!adapter) {
    const recorded = await options.auditStore.record({
      ...baseAudit,
      argsHash,
      outputHash: null,
      status: "FAILED",
      errorClass: "INTERNAL",
      attempt: 1,
      durationMs: 0,
    });
    if (!recorded.ok) {
      return {
        ok: false,
        errorClass: "INTERNAL",
        code: "audit_write_failed",
        attempts: 1,
        auditIds,
      };
    }
    return {
      ok: false,
      errorClass: "INTERNAL",
      code: "adapter_missing",
      attempts: 1,
      auditIds: [recorded.id],
    };
  }

  const timeoutMs = timeoutFor(manifest, options.timeoutMsByClass);
  const classPolicy = TOOL_TIMEOUT_POLICY[manifest.timeoutClass];
  const maxAttempts = Math.min(manifest.maxAttempts, classPolicy.maxAttempts);
  const input = request.input as Record<string, unknown>;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = now().getTime();
    let outcome: AdapterOutcome;
    try {
      outcome = await runWithTimeout(
        adapter,
        input,
        {
          workspaceId: request.workspaceId,
          invocationKey: request.invocationKey,
          now,
        },
        timeoutMs,
      );
    } catch (error) {
      const shape = classifyToolError(error);
      const elapsed = durationMs(startedAt, now().getTime());
      const recorded = await options.auditStore.record({
        ...baseAudit,
        argsHash,
        outputHash: null,
        status: "FAILED",
        errorClass: shape.errorClass,
        attempt,
        durationMs: elapsed,
      });
      if (!recorded.ok) {
        return {
          ok: false,
          errorClass: "INTERNAL",
          code: "audit_write_failed",
          attempts: attempt,
          auditIds,
        };
      }
      auditIds.push(recorded.id);

      if (shape.retryable && attempt < maxAttempts) {
        try {
          await sleep(classPolicy.backoffMs);
        } catch {
          return {
            ok: false,
            errorClass: "INTERNAL",
            code: "retry_sleep_failed",
            attempts: attempt,
            auditIds,
          };
        }
        continue;
      }

      return {
        ok: false,
        errorClass: shape.errorClass,
        code: shape.code,
        attempts: attempt,
        auditIds,
      };
    }

    const elapsed = durationMs(startedAt, now().getTime());

    if (!outcome.ok) {
      const shape: ToolErrorShape = {
        errorClass: "TIMEOUT",
        code: "timeout",
        retryable: true,
      };
      const recorded = await options.auditStore.record({
        ...baseAudit,
        argsHash,
        outputHash: null,
        status: "FAILED",
        errorClass: shape.errorClass,
        attempt,
        durationMs: elapsed,
      });
      if (!recorded.ok) {
        return {
          ok: false,
          errorClass: "INTERNAL",
          code: "audit_write_failed",
          attempts: attempt,
          auditIds,
        };
      }
      auditIds.push(recorded.id);

      if (shape.retryable && attempt < maxAttempts) {
        try {
          await sleep(classPolicy.backoffMs);
        } catch {
          return {
            ok: false,
            errorClass: "INTERNAL",
            code: "retry_sleep_failed",
            attempts: attempt,
            auditIds,
          };
        }
        continue;
      }

      return {
        ok: false,
        errorClass: shape.errorClass,
        code: shape.code,
        attempts: attempt,
        auditIds,
      };
    }

    const outputErrors = validateToolOutput(manifest, outcome.value);
    if (outputErrors.length > 0) {
      const recorded = await options.auditStore.record({
        ...baseAudit,
        argsHash,
        outputHash: null,
        status: "FAILED",
        errorClass: "INTERNAL",
        attempt,
        durationMs: elapsed,
      });
      if (!recorded.ok) {
        return {
          ok: false,
          errorClass: "INTERNAL",
          code: "audit_write_failed",
          attempts: attempt,
          auditIds,
        };
      }
      auditIds.push(recorded.id);
      return {
        ok: false,
        errorClass: "INTERNAL",
        code: "output_invalid",
        attempts: attempt,
        auditIds,
      };
    }

    const outputHash = hashJsonSafe(outcome.value);
    const recorded = await options.auditStore.record({
      ...baseAudit,
      argsHash,
      outputHash,
      status: "SUCCEEDED",
      errorClass: null,
      attempt,
      durationMs: elapsed,
    });
    if (!recorded.ok) {
      return {
        ok: false,
        errorClass: "INTERNAL",
        code: "audit_write_failed",
        attempts: attempt,
        auditIds,
      };
    }
    auditIds.push(recorded.id);

    return {
      ok: true,
      output: outcome.value,
      attempts: attempt,
      auditIds,
    };
  }

  return {
    ok: false,
    errorClass: "INTERNAL",
    code: "attempts_exhausted",
    attempts: maxAttempts,
    auditIds,
  };
}

/** Exposed for tests and callers that need to classify an adapter failure. */
export function toToolError(
  errorClass: ToolErrorClass,
  code: string,
  message = code,
): ToolError {
  return new ToolError(errorClass, code, message);
}
