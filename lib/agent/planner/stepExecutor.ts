/**
 * Phase B B4 step executor.
 *
 * Executes a single plan step with retries, timeouts, and audit. Content-free:
 * records hashes only, never raw content or plaintext secrets.
 */

import type { PlanStep } from "./plannerTypes.ts";

/**
 * Step executor configuration.
 */
export type StepExecutorConfig = Readonly<{
  maxAttemptsDefault: number;
  timeoutMsDefault: number;
  backoffMsDefault: number;
}>;

export const DEFAULT_STEP_EXECUTOR_CONFIG: StepExecutorConfig = {
  maxAttemptsDefault: 2,
  timeoutMsDefault: 30_000,
  backoffMsDefault: 250,
};

export type StepExecutionRequest = Readonly<{
  planId: string;
  stepId: string;
  toolName: string;
  toolVersion: string;
  toolFamily: string;
  inputsHash: string;
}>;

export type StepExecutionResult =
  | {
      ok: true;
      outputsHash: string;
      attempts: number;
      durationMs: number;
    }
  | {
      ok: false;
      errorClass: string;
      code: string;
      attempts: number;
      durationMs: number;
    };

function defaultSleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function durationMs(startedAt: number, finishedAt: number): number {
  return Math.min(
    600_000,
    Math.max(0, Math.round(finishedAt - startedAt)),
  );
}

/**
 * Execute a single plan step through an injected adapter. Content-free:
 * the adapter receives only hashes, never raw inputs or plaintext secrets.
 */
export async function executePlanStep(
  adapter: (
    inputsHash: string,
    context: { planId: string; stepId: string },
  ) => Promise<{ outputsHash: string }>,
  request: StepExecutionRequest,
  config: StepExecutorConfig = DEFAULT_STEP_EXECUTOR_CONFIG,
  now?: () => Date,
  sleep?: (milliseconds: number) => Promise<void>,
): Promise<StepExecutionResult> {
  const nowFn = now ?? (() => new Date());
  const sleepFn = sleep ?? defaultSleep;
  const maxAttempts = Math.min(
    config.maxAttemptsDefault,
    3, // hard cap from migration constraint
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = nowFn().getTime();
    let outcome: { ok: true; outputsHash: string } | { ok: false; reason: "timeout" };

    try {
      outcome = await Promise.race([
        adapter(request.inputsHash, {
          planId: request.planId,
          stepId: request.stepId,
        }).then((value) => ({ ok: true as const, outputsHash: value.outputsHash })),
        new Promise<{ ok: false; reason: "timeout" }>((resolve) => {
          setTimeout(
            () => resolve({ ok: false, reason: "timeout" }),
            config.timeoutMsDefault,
          );
        }),
      ]);
    } catch {
      const elapsed = durationMs(startedAt, nowFn().getTime());
      if (attempt < maxAttempts) {
        try {
          await sleepFn(config.backoffMsDefault);
        } catch {
          return {
            ok: false,
            errorClass: "INTERNAL",
            code: "retry_sleep_failed",
            attempts: attempt,
            durationMs: elapsed,
          };
        }
        continue;
      }
      return {
        ok: false,
        errorClass: "INTERNAL",
        code: "unexpected_error",
        attempts: attempt,
        durationMs: elapsed,
      };
    }

    const elapsed = durationMs(startedAt, nowFn().getTime());

    if (!outcome.ok) {
      if (attempt < maxAttempts) {
        try {
          await sleepFn(config.backoffMsDefault);
        } catch {
          return {
            ok: false,
            errorClass: "INTERNAL",
            code: "retry_sleep_failed",
            attempts: attempt,
            durationMs: elapsed,
          };
        }
        continue;
      }
      return {
        ok: false,
        errorClass: "TIMEOUT",
        code: "timeout",
        attempts: attempt,
        durationMs: elapsed,
      };
    }

    return {
      ok: true,
      outputsHash: outcome.outputsHash,
      attempts: attempt,
      durationMs: elapsed,
    };
  }

  return {
    ok: false,
    errorClass: "INTERNAL",
    code: "attempts_exhausted",
    attempts: maxAttempts,
    durationMs: 0,
  };
}