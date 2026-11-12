/**
 * Phase B B6: Usage ledger — tenant-scoped, append-only metering.
 *
 * Records every model invocation: model, tokens in/out, cost estimate,
 * duration, workspace, and task. Append-only by design — entries are never
 * modified or deleted, providing an auditable spend trail.
 *
 * Zero new dependencies. Additive only.
 */

export interface UsageLedgerEntry {
  id: string;
  workspaceId: string;
  taskId: string | null;
  model: string;
  provider: "mock" | "openai" | "openai-compatible";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimateUsd: number;
  durationMs: number;
  createdAt: number; // epoch ms
}

export interface UsageLedgerRollup {
  workspaceId: string;
  taskCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostEstimateUsd: number;
  periodStartMs: number;
  periodEndMs: number;
}

export interface UsageLedger {
  record(entry: Omit<UsageLedgerEntry, "id" | "createdAt">): Promise<string>;
  list(workspaceId: string): Promise<UsageLedgerEntry[]>;
  rollup(
    workspaceId: string,
    periodStartMs: number,
    periodEndMs: number,
  ): Promise<UsageLedgerRollup>;
}

export interface UsageLedgerMemory extends UsageLedger {
  entries: UsageLedgerEntry[];
}

export function createUsageLedgerMemory(): UsageLedgerMemory {
  const entries: UsageLedgerEntry[] = [];
  let counter = 0;

  return {
    entries,
    async record(entry) {
      counter += 1;
      const recordEntry: UsageLedgerEntry = {
        id: `ledger-${counter}`,
        ...entry,
        createdAt: Date.now(),
      };
      entries.push(recordEntry);
      return recordEntry.id;
    },
    async list(workspaceId) {
      return entries
        .filter((e) => e.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async rollup(workspaceId, periodStartMs, periodEndMs) {
      const workspaceEntries = entries.filter(
        (e) =>
          e.workspaceId === workspaceId &&
          e.createdAt >= periodStartMs &&
          e.createdAt <= periodEndMs,
      );
      const totalInputTokens = workspaceEntries.reduce(
        (sum, e) => sum + e.inputTokens,
        0,
      );
      const totalOutputTokens = workspaceEntries.reduce(
        (sum, e) => sum + e.outputTokens,
        0,
      );
      const totalCostEstimateUsd = workspaceEntries.reduce(
        (sum, e) => sum + e.costEstimateUsd,
        0,
      );
      return {
        workspaceId,
        taskCount: workspaceEntries.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCostEstimateUsd,
        periodStartMs,
        periodEndMs,
      };
    },
  };
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Conservative deterministic estimates; real pricing comes from provider
  // terms at activation time (OD-B6). These are placeholder bounds only.
  const per1kInput = 0.0015;
  const per1kOutput = 0.006;
  const inputCost = (inputTokens / 1000) * per1kInput;
  const outputCost = (outputTokens / 1000) * per1kOutput;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

export function estimateTokens(text: string): number {
  // Conservative character-based estimate: ~4 chars per token.
  return Math.ceil(text.length / 4);
}
