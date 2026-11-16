import { hashJson } from "../tools/hash.ts";
import {
  BROWSER_ACTION_LABELS,
  BROWSER_APPROVAL_TTL_MS,
  BROWSER_SANDBOX_PREFIX,
  BROWSER_STAGING_PREFIX,
  browserFail,
  browserOk,
  type BrowserResult,
  type BrowserSideEffectingAction,
} from "./types.ts";

/**
 * Approval gate bridge (draft scope C4, matrix AP-01 … AP-08).
 *
 * Every side-effecting action needs its own approval, bound to the exact
 * session, action and target URL. A token is single-purpose: it cannot move to
 * another target, it expires, and it can be revoked before execution. A store
 * error fails closed — the gate never defaults to allow.
 */

export const BROWSER_APPROVAL_OUTCOMES = [
  "approved",
  "denied",
  "expired",
  "revoked",
] as const;

export type BrowserApprovalOutcome = (typeof BROWSER_APPROVAL_OUTCOMES)[number];

export type BrowserApprovalRequest = Readonly<{
  id: string;
  workspaceId: string;
  sessionId: string;
  action: BrowserSideEffectingAction;
  targetUrl: string;
  description: string;
  requestedAt: string;
  expiresAt: string;
}>;

export type BrowserApprovalResolver = (
  request: BrowserApprovalRequest,
) => BrowserApprovalOutcome | Promise<BrowserApprovalOutcome>;

export type BrowserApprovalToken = Readonly<{
  tokenId: string;
  workspaceId: string;
  sessionId: string;
  action: BrowserSideEffectingAction;
  targetHash: string;
  issuedAt: string;
  expiresAt: string;
}>;

export type BrowserApprovalCheck = Readonly<{
  sessionId: string;
  action: BrowserSideEffectingAction;
  targetUrl: string;
}>;

export type BrowserApprovalGate = Readonly<{
  promptFor(target: Readonly<{ action: BrowserSideEffectingAction; targetUrl: string }>): string;
  request(input: Readonly<{
    workspaceId: string;
    sessionId: string;
    action: BrowserSideEffectingAction;
    targetUrl: string;
  }>): Promise<BrowserResult<BrowserApprovalToken>>;
  verify(
    token: BrowserApprovalToken | null | undefined,
    expected: BrowserApprovalCheck,
  ): BrowserResult<true>;
  revoke(tokenId: string): void;
}>;

export type BrowserApprovalGateOptions = Readonly<{
  resolver: BrowserApprovalResolver;
  clock?: () => Date;
  ttlMs?: number;
}>;

function targetHash(input: BrowserApprovalCheck): string {
  return hashJson({
    sessionId: input.sessionId,
    action: input.action,
    targetUrl: input.targetUrl,
  });
}

export function describeBrowserApproval(
  target: Readonly<{ action: BrowserSideEffectingAction; targetUrl: string }>,
): string {
  return `Approve: ${BROWSER_ACTION_LABELS[target.action]} on ${target.targetUrl}`;
}

export function createApprovalGate(
  options: BrowserApprovalGateOptions,
): BrowserApprovalGate {
  const clock = options.clock ?? (() => new Date());
  const ttlMs = options.ttlMs ?? BROWSER_APPROVAL_TTL_MS;
  const revoked = new Set<string>();

  return {
    promptFor(target) {
      return describeBrowserApproval(target);
    },

    async request(input) {
      const now = clock();
      const request: BrowserApprovalRequest = Object.freeze({
        id: `apr_${hashJson(input).slice(0, 24)}`,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        action: input.action,
        targetUrl: input.targetUrl,
        description: describeBrowserApproval(input),
        requestedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      });

      let outcome: BrowserApprovalOutcome;
      try {
        outcome = await options.resolver(request);
      } catch {
        return browserFail(
          "approval_store_error",
          "approval store failed, refusing to act",
        );
      }

      if (outcome === "denied") {
        return browserFail("approval_denied", "the user denied this action");
      }
      if (outcome === "expired") {
        return browserFail("approval_expired", "the approval window closed");
      }
      if (outcome === "revoked") {
        return browserFail("approval_revoked", "the approval was revoked");
      }
      if (outcome !== "approved") {
        return browserFail(
          "approval_store_error",
          "approval store returned an unknown outcome",
        );
      }

      return browserOk(
        Object.freeze({
          tokenId: `tok_${hashJson({ request: request.id, target: targetHash(input) }).slice(0, 24)}`,
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          action: input.action,
          targetHash: targetHash(input),
          issuedAt: request.requestedAt,
          expiresAt: request.expiresAt,
        }),
      );
    },

    verify(token, expected) {
      if (token === null || token === undefined) {
        return browserFail("missing_approval", "no approval token was supplied");
      }
      if (revoked.has(token.tokenId)) {
        return browserFail("approval_revoked", "the approval was revoked");
      }
      if (new Date(token.expiresAt).getTime() <= clock().getTime()) {
        return browserFail("approval_expired", "the approval expired before use");
      }
      if (token.targetHash !== targetHash(expected)) {
        return browserFail(
          "target_mismatch",
          "the approval was granted for a different action or target",
        );
      }
      return browserOk(true);
    },

    revoke(tokenId) {
      revoked.add(tokenId);
    },
  };
}

/**
 * Uploads may only read from the workspace staging prefix; downloads may only
 * land in the sandbox prefix. Anything that looks like a host path is refused.
 */
export function checkUploadSource(
  path: string,
  workspaceId?: string,
): BrowserResult<true> {
  if (typeof path !== "string" || !path.startsWith(BROWSER_STAGING_PREFIX)) {
    return browserFail(
      "upload_source_not_staged",
      "upload source must be inside tenant staging",
    );
  }
  const rest = path.slice(BROWSER_STAGING_PREFIX.length);
  if (rest.length === 0 || rest.includes("..") || rest.startsWith("/")) {
    return browserFail(
      "upload_source_not_staged",
      "upload source is not a staged relative path",
    );
  }
  if (workspaceId !== undefined && !rest.startsWith(`${workspaceId}/`)) {
    return browserFail(
      "upload_source_not_staged",
      "upload source belongs to another workspace",
    );
  }
  return browserOk(true);
}

export function checkDownloadDestination(
  path: string,
  workspaceId?: string,
): BrowserResult<true> {
  if (typeof path !== "string" || !path.startsWith(BROWSER_SANDBOX_PREFIX)) {
    return browserFail(
      "download_destination_not_sandbox",
      "downloads may only be written to sandbox storage",
    );
  }
  const rest = path.slice(BROWSER_SANDBOX_PREFIX.length);
  if (rest.length === 0 || rest.includes("..") || /^[A-Za-z]:/.test(rest)) {
    return browserFail(
      "download_destination_not_sandbox",
      "download destination is not a sandbox path",
    );
  }
  if (workspaceId !== undefined && !rest.startsWith(`${workspaceId}/`)) {
    return browserFail(
      "download_destination_not_sandbox",
      "download destination belongs to another workspace",
    );
  }
  return browserOk(true);
}
