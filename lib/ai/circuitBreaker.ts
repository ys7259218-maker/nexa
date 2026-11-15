/**
 * Phase B B6: Circuit breaker for budget ceilings.
 *
 * Prevents runaway model/tool spend by tracking per-task and per-workspace
 * spend against configurable ceilings. When a ceiling is breached, the
 * breaker opens and routes to mock fallback — never silently "acts smart".
 *
 * Zero new dependencies. Additive only.
 */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerCeilings {
  perTaskCostUsd: number;
  perTaskTokens: number;
  perTaskDurationMs: number;
  perWorkspaceDailyCostUsd: number;
  perWorkspaceDailyTokens: number;
}

export interface BreakerDecision {
  allowed: boolean;
  state: BreakerState;
  reason: string | null;
  ceiling: "per-task-cost" | "per-task-tokens" | "per-task-duration" |
    "per-workspace-daily-cost" | "per-workspace-daily-tokens" | null;
}

export interface CircuitBreaker {
  check(
    workspaceId: string,
    taskId: string | null,
    estimatedCostUsd: number,
    estimatedTokens: number,
    estimatedDurationMs: number,
  ): BreakerDecision;
  recordUsage(
    workspaceId: string,
    taskId: string | null,
    costUsd: number,
    tokens: number,
    durationMs: number,
  ): void;
  reset(workspaceId: string): void;
  getState(workspaceId: string): BreakerState;
}

export interface CircuitBreakerMemory extends CircuitBreaker {
  taskUsage: Map<string, { costUsd: number; tokens: number; durationMs: number }>;
  workspaceDailyUsage: Map<string, { costUsd: number; tokens: number }>;
  workspaceDate: Map<string, string>;
  breakerState: Map<string, BreakerState>;
  failureCount: Map<string, number>;
  lastFailureTime: Map<string, number>;
}

export const DEFAULT_CEILINGS: BreakerCeilings = {
  perTaskCostUsd: 0.10,
  perTaskTokens: 50000,
  perTaskDurationMs: 600000, // 10 minutes
  perWorkspaceDailyCostUsd: 10.00,
  perWorkspaceDailyTokens: 500000,
};

export function createCircuitBreakerMemory(
  ceilings: BreakerCeilings = DEFAULT_CEILINGS,
): CircuitBreakerMemory {
  const taskUsage = new Map<
    string,
    { costUsd: number; tokens: number; durationMs: number }
  >();
  const workspaceDailyUsage = new Map<
    string,
    { costUsd: number; tokens: number }
  >();
  const workspaceDate = new Map<string, string>();
  const breakerState = new Map<string, BreakerState>();
  const failureCount = new Map<string, number>();
  const lastFailureTime = new Map<string, number>();

  const todayKey = () => new Date().toISOString().slice(0, 10);

  return {
    taskUsage,
    workspaceDailyUsage,
    workspaceDate,
    breakerState,
    failureCount,
    lastFailureTime,

    check(workspaceId, taskId, estimatedCostUsd, estimatedTokens, estimatedDurationMs) {
      const state = breakerState.get(workspaceId) ?? "closed";

      // Per-task ceilings (only if taskId provided).
      if (taskId !== null) {
        const existing = taskUsage.get(taskId) ?? {
          costUsd: 0,
          tokens: 0,
          durationMs: 0,
        };
        const projectedCost = existing.costUsd + estimatedCostUsd;
        const projectedTokens = existing.tokens + estimatedTokens;
        const projectedDuration = existing.durationMs + estimatedDurationMs;

        if (projectedCost > ceilings.perTaskCostUsd) {
          return {
            allowed: false,
            state,
            reason: "per-task cost ceiling would be exceeded",
            ceiling: "per-task-cost",
          };
        }
        if (projectedTokens > ceilings.perTaskTokens) {
          return {
            allowed: false,
            state,
            reason: "per-task token ceiling would be exceeded",
            ceiling: "per-task-tokens",
          };
        }
        if (projectedDuration > ceilings.perTaskDurationMs) {
          return {
            allowed: false,
            state,
            reason: "per-task duration ceiling would be exceeded",
            ceiling: "per-task-duration",
          };
        }
      }

      // Per-workspace daily ceiling (resets at UTC midnight).
      const today = todayKey();
      const storedDate = workspaceDate.get(workspaceId);
      if (storedDate !== today) {
        workspaceDailyUsage.set(workspaceId, {
          costUsd: 0,
          tokens: 0,
        });
        workspaceDate.set(workspaceId, today);
      }
      const daily = workspaceDailyUsage.get(workspaceId) ?? {
        costUsd: 0,
        tokens: 0,
      };
      const projectedDailyCost = daily.costUsd + estimatedCostUsd;
      const projectedDailyTokens = daily.tokens + estimatedTokens;

      if (projectedDailyCost > ceilings.perWorkspaceDailyCostUsd) {
        return {
          allowed: false,
          state,
          reason: "per-workspace daily cost ceiling would be exceeded",
          ceiling: "per-workspace-daily-cost",
        };
      }
      if (projectedDailyTokens > ceilings.perWorkspaceDailyTokens) {
        return {
          allowed: false,
          state,
          reason: "per-workspace daily token ceiling would be exceeded",
          ceiling: "per-workspace-daily-tokens",
        };
      }

      return { allowed: true, state, reason: null, ceiling: null };
    },

    recordUsage(workspaceId, taskId, costUsd, tokens, durationMs) {
      if (taskId !== null) {
        const existing = this.taskUsage.get(taskId) ?? {
          costUsd: 0,
          tokens: 0,
          durationMs: 0,
        };
        this.taskUsage.set(taskId, {
          costUsd: existing.costUsd + costUsd,
          tokens: existing.tokens + tokens,
          durationMs: existing.durationMs + durationMs,
        });
      }

      const today = todayKey();
      const storedDate = this.workspaceDate.get(workspaceId);
      if (storedDate !== today) {
        this.workspaceDailyUsage.set(workspaceId, {
          costUsd: 0,
          tokens: 0,
        });
        this.workspaceDate.set(workspaceId, today);
      }
      const daily = this.workspaceDailyUsage.get(workspaceId) ?? {
        costUsd: 0,
        tokens: 0,
      };
      this.workspaceDailyUsage.set(workspaceId, {
        costUsd: daily.costUsd + costUsd,
        tokens: daily.tokens + tokens,
      });
    },

    reset(workspaceId) {
      this.breakerState.set(workspaceId, "closed");
      this.failureCount.set(workspaceId, 0);
      this.lastFailureTime.set(workspaceId, 0);
    },

    getState(workspaceId) {
      return this.breakerState.get(workspaceId) ?? "closed";
    },
  };
}
