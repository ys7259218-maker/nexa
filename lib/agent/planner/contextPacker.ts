/**
 * Phase B B4 context packer.
 *
 * Packs bounded recent turns + workspace context into plan input,
 * token-bounded. Content-free: produces a hash, never raw content.
 */

/**
 * Phase B B4 context packer.
 *
 * Packs bounded recent turns + workspace context into plan input,
 * token-bounded. Content-free: produces a hash, never raw content.
 */

import { createHash } from "node:crypto";

import { HASH_PATTERN } from "./plannerTypes.ts";

const WORKSPACE_ID_PATTERN = /^[-A-Za-z0-9:_.]{1,200}$/;

/**
 * Context packer configuration.
 */
export type ContextPackerConfig = Readonly<{
  maxTokens: number;
  maxRecentTurns: number;
}>;

export const DEFAULT_CONTEXT_PACKER_CONFIG: ContextPackerConfig = {
  maxTokens: 4096,
  maxRecentTurns: 10,
};

export type PackedContext = Readonly<{
  contextHash: string;
  tokenCount: number;
  turnCount: number;
  truncated: boolean;
}>;

function countTokens(text: string): number {
  // Approximate token count: ~4 chars per token for English text.
  return Math.ceil(text.length / 4);
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonical JSON does not accept non-finite numbers");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }

  throw new Error("canonical JSON only accepts JSON-compatible values");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashJson(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/**
 * Pack context into a bounded, content-free hash. Never stores raw content.
 * Returns the content hash plus metadata about how much was included.
 */
export function packContext(
  workspaceId: string,
  recentTurns: Array<{ role: string; content: string }>,
  workspaceContext: Record<string, unknown>,
  config: ContextPackerConfig = DEFAULT_CONTEXT_PACKER_CONFIG,
): PackedContext {
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    throw new Error("invalid workspace id");
  }

  let tokenCount = 0;
  let truncated = false;
  const includedTurns: Array<{ role: string; contentHash: string }> = [];

  // Pack recent turns newest-first until token cap.
  for (let i = recentTurns.length - 1; i >= 0; i -= 1) {
    if (includedTurns.length >= config.maxRecentTurns) {
      truncated = true;
      break;
    }
    const turn = recentTurns[i];
    const turnTokens = countTokens(turn.content);
    if (tokenCount + turnTokens > config.maxTokens) {
      truncated = true;
      break;
    }
    tokenCount += turnTokens;
    includedTurns.unshift({
      role: turn.role,
      contentHash: sha256Hex(turn.content),
    });
  }

  // Pack workspace context metadata (keys only, never values).
  const contextKeys = Object.keys(workspaceContext).sort();
  tokenCount += contextKeys.join("").length;
  if (tokenCount > config.maxTokens) {
    truncated = true;
  }

  const packed = hashJson({
    workspaceId,
    turns: includedTurns,
    contextKeys,
    maxTokens: config.maxTokens,
    maxRecentTurns: config.maxRecentTurns,
  });

  return {
    contextHash: packed,
    tokenCount,
    turnCount: includedTurns.length,
    truncated,
  };
}

/**
 * Validate that a plan step's inputs hash is content-free and valid.
 */
export function validateInputsHash(inputsHash: unknown): boolean {
  return typeof inputsHash === "string" && HASH_PATTERN.test(inputsHash);
}
