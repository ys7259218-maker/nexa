import {
  BROWSER_SESSION_IDLE_MS,
  BROWSER_SESSION_TTL_MS,
  BrowserDriverError,
  browserFail,
  browserOk,
  isSideEffectingAction,
  type BrowserAction,
  type BrowserDriver,
  type BrowserDriverPage,
  type BrowserReadAction,
  type BrowserResult,
  type BrowserSideEffectingAction,
} from "./types.ts";
import { hashJson } from "../tools/hash.ts";
import {
  evaluateRedirectChain,
  policyHash,
  type BrowserSessionPolicy,
} from "./sessionPolicy.ts";
import { captureEvidence, hashBytes, type EvidenceStore } from "./evidence.ts";
import {
  checkDownloadDestination,
  checkUploadSource,
  type BrowserApprovalGate,
  type BrowserApprovalToken,
} from "./approvalGate.ts";
import { createMockDriver, type MockPageDefinition } from "./mockDriver.ts";
import {
  createPlaywrightDriver,
  type PlaywrightLoader,
} from "./playwrightDriver.ts";

/**
 * Session lifecycle over a driver (draft scope C5, matrix SL-01 … SL-06).
 *
 * The service owns TTL, idle timeout, the kill switch, and teardown. It never
 * guesses a driver state: every failure is typed, and a partial teardown is
 * reported as `teardown_failed` rather than a clean close.
 */

export const BROWSER_SESSION_STATES = ["open", "ended"] as const;

export type BrowserSessionState = (typeof BROWSER_SESSION_STATES)[number];

export const BROWSER_TEARDOWN_STATUSES = [
  "pending",
  "closed",
  "teardown_failed",
  "aborted",
] as const;

export type BrowserTeardownStatus =
  (typeof BROWSER_TEARDOWN_STATUSES)[number];

export type BrowserSessionRecord = {
  sessionId: string;
  workspaceId: string;
  taskId: string;
  policyHash: string;
  startedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  state: BrowserSessionState;
  teardownStatus: BrowserTeardownStatus;
  evidenceRefs: string[];
  abortReason: string | null;
};

export type BrowserAuditEvent = Readonly<{
  kind:
    | "session_opened"
    | "session_ended"
    | "session_aborted"
    | "action_denied"
    | "action_completed"
    | "teardown_failed";
  sessionId: string;
  detail: string;
  occurredAt: string;
}>;

export type BrowserServiceDeps = Readonly<{
  driver: BrowserDriver;
  policy: BrowserSessionPolicy;
  evidenceStore: EvidenceStore;
  approvalGate: BrowserApprovalGate;
  clock?: () => Date;
  ttlMs?: number;
  idleMs?: number;
  audit?: (event: BrowserAuditEvent) => void;
}>;

export type BrowserActInput = Readonly<{
  action: BrowserAction;
  targetUrl: string;
  selector?: string | null;
  approvalToken?: BrowserApprovalToken | null;
  stagedFile?: string | null;
  sandboxPath?: string | null;
}>;

export type BrowserActResult = Readonly<{
  url: string;
  evidence: readonly string[];
}>;

export type BrowserInspectionResult = Readonly<{
  url: string;
  title: string;
  redirected: boolean;
  screenshotHash: string;
  domHash: string;
}>;

export type BrowserTeardownResult = Readonly<{
  teardownStatus: BrowserTeardownStatus;
  profileFiles: number;
}>;

export type BrowserService = Readonly<{
  openSession(input: Readonly<{ workspaceId: string; taskId: string }>): Promise<BrowserResult<BrowserSessionRecord>>;
  getSession(sessionId: string): BrowserSessionRecord | null;
  inspect(sessionId: string, input: Readonly<{ targetUrl: string }>): Promise<BrowserResult<BrowserInspectionResult>>;
  act(sessionId: string, input: BrowserActInput): Promise<BrowserResult<BrowserActResult>>;
  closeSession(sessionId: string, reason?: string): Promise<BrowserResult<BrowserTeardownResult>>;
  killSwitch(sessionId: string, reason: string): BrowserResult<true>;
  purgeTask(taskId: string): Promise<number>;
}>;

const READ_ACTIONS: readonly BrowserReadAction[] = ["navigate", "screenshot", "dom_read"];

/** Normalised equality for the approved target and the rendered page URL. */
function sameUrl(left: string, right: string): boolean {
  try {
    return new URL(left).toString() === new URL(right).toString();
  } catch {
    return false;
  }
}

export function createBrowserService(deps: BrowserServiceDeps): BrowserService {
  const clock = deps.clock ?? (() => new Date());
  const ttlMs = deps.ttlMs ?? BROWSER_SESSION_TTL_MS;
  const idleMs = deps.idleMs ?? BROWSER_SESSION_IDLE_MS;
  const sessions = new Map<string, BrowserSessionRecord>();
  const audit = deps.audit ?? (() => undefined);

  function record(event: BrowserAuditEvent) {
    audit(event);
  }

  function sessionOf(sessionId: string): BrowserSessionRecord | null {
    return sessions.get(sessionId) ?? null;
  }

  async function endSession(
    session: BrowserSessionRecord,
    teardown: BrowserTeardownStatus,
    detail: string,
  ): Promise<BrowserTeardownResult> {
    if (session.state === "ended") {
      return { teardownStatus: session.teardownStatus, profileFiles: deps.driver.profileFileCount() };
    }
    session.state = "ended";
    let status: BrowserTeardownStatus = teardown;
    try {
      await deps.driver.close();
      await deps.driver.wipeProfile();
      if (deps.driver.profileFileCount() !== 0) {
        status = "teardown_failed";
      }
    } catch {
      status = "teardown_failed";
    }
    session.teardownStatus = status;
    record({
      kind: status === "teardown_failed" ? "teardown_failed" : "session_ended",
      sessionId: session.sessionId,
      detail,
      occurredAt: clock().toISOString(),
    });
    return { teardownStatus: status, profileFiles: deps.driver.profileFileCount() };
  }

  async function ensureUsable(
    session: BrowserSessionRecord,
  ): Promise<BrowserResult<true>> {
    if (session.abortReason !== null) {
      await endSession(session, "aborted", session.abortReason);
      return browserFail("session_aborted", session.abortReason);
    }
    if (session.state === "ended") {
      return browserFail("session_ended", "the session has already ended");
    }
    const now = clock().getTime();
    if (now >= new Date(session.expiresAt).getTime()) {
      await endSession(session, "aborted", "session ttl reached");
      return browserFail("session_expired", "the session TTL was reached");
    }
    if (now - new Date(session.lastActivityAt).getTime() >= idleMs) {
      await endSession(session, "aborted", "session idle timeout reached");
      return browserFail("session_expired", "the session idle timeout was reached");
    }
    return browserOk(true);
  }

  async function capture(
    session: BrowserSessionRecord,
    phase: "before" | "after",
    url: string,
  ): Promise<BrowserResult<string>> {
    try {
      const screenshot = await deps.driver.screenshot();
      const dom = await deps.driver.domSnapshot();
      const descriptor = await captureEvidence(deps.evidenceStore, {
        workspaceId: session.workspaceId,
        taskId: session.taskId,
        sessionId: session.sessionId,
        phase,
        url,
        capturedAt: clock().toISOString(),
        payload: { screenshot: screenshot.bytes, dom: dom.bytes },
      });
      session.evidenceRefs.push(descriptor.id);
      return browserOk(descriptor.id);
    } catch {
      return browserFail(
        "evidence_write_failed",
        `could not record ${phase} evidence, the action is reported as failed`,
      );
    }
  }

  return {
    async openSession(input) {
      const now = clock();
      const sessionId = `bs_${hashJson({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        startedAt: now.toISOString(),
      }).slice(0, 24)}`;

      const session: BrowserSessionRecord = {
        sessionId,
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        policyHash: policyHash(deps.policy),
        startedAt: now.toISOString(),
        lastActivityAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        state: "open",
        teardownStatus: "pending",
        evidenceRefs: [],
        abortReason: null,
      };
      sessions.set(sessionId, session);
      record({
        kind: "session_opened",
        sessionId,
        detail: `policy ${session.policyHash}`,
        occurredAt: now.toISOString(),
      });
      return browserOk(session);
    },

    getSession: sessionOf,

    async inspect(sessionId, input) {
      const session = sessionOf(sessionId);
      if (session === null) {
        return browserFail("session_ended", "unknown session");
      }
      const usable = await ensureUsable(session);
      if (!usable.ok) return usable;

      const decision = await evaluateRedirectChain(deps.policy, [input.targetUrl]);
      if (!decision.allowed) {
        record({
          kind: "action_denied",
          sessionId,
          detail: `${decision.reason}: ${input.targetUrl}`,
          occurredAt: clock().toISOString(),
        });
        return browserFail(decision.reason, decision.detail);
      }

      try {
        const page = await deps.driver.open(decision.url);
        const screenshot = await deps.driver.screenshot();
        const dom = await deps.driver.domSnapshot();
        session.lastActivityAt = clock().toISOString();
        return browserOk({
          url: page.url,
          title: page.title,
          redirected: page.redirected,
          screenshotHash: hashBytes(screenshot.bytes),
          domHash: hashBytes(dom.bytes),
        });
      } catch (error) {
        return browserFail(
          error instanceof BrowserDriverError ? error.code : "driver_error",
          "inspection failed",
        );
      }
    },

    async act(sessionId, input) {
      const session = sessionOf(sessionId);
      if (session === null) {
        return browserFail("session_ended", "unknown session");
      }
      const usable = await ensureUsable(session);
      if (!usable.ok) return usable;

      const decision = await evaluateRedirectChain(deps.policy, [input.targetUrl]);
      if (!decision.allowed) {
        record({
          kind: "action_denied",
          sessionId,
          detail: `${decision.reason}: ${input.action} ${input.targetUrl}`,
          occurredAt: clock().toISOString(),
        });
        return browserFail(decision.reason, decision.detail);
      }

      const sideEffecting = isSideEffectingAction(input.action);
      const evidence: string[] = [];

      if (sideEffecting) {
        const verified = deps.approvalGate.verify(input.approvalToken ?? null, {
          sessionId,
          action: input.action,
          targetUrl: input.targetUrl,
        });
        if (!verified.ok) {
          record({
            kind: "action_denied",
            sessionId,
            detail: `${verified.reason}: ${input.action} ${input.targetUrl}`,
            occurredAt: clock().toISOString(),
          });
          return verified;
        }
        if (input.action === "upload") {
          const staged = checkUploadSource(input.stagedFile ?? "", session.workspaceId);
          if (!staged.ok) return staged;
        }
        if (input.action === "download") {
          const destination = checkDownloadDestination(
            input.sandboxPath ?? "",
            session.workspaceId,
          );
          if (!destination.ok) return destination;
        }
      }

      // Open the reviewed target first. A side-effecting action needs a live
      // page, and the before-evidence must describe the page the action runs
      // on. Nothing is performed until the rendered redirect chain is checked.
      let page: BrowserDriverPage;
      try {
        page = await deps.driver.open(decision.url);
      } catch (error) {
        return browserFail(
          error instanceof BrowserDriverError ? error.code : "driver_error",
          "driver refused the action",
        );
      }

      // Redirect guard on the chain the driver actually rendered (SP-06). An
      // off-list hop ends the session: the page is no longer trusted.
      const landed = await evaluateRedirectChain(
        deps.policy,
        page.redirectChain.length > 0 ? page.redirectChain : [page.url],
      );
      if (!landed.allowed) {
        record({
          kind: "action_denied",
          sessionId,
          detail: `${landed.reason}: ${input.action} ${input.targetUrl}`,
          occurredAt: clock().toISOString(),
        });
        await endSession(session, "aborted", `off-list redirect during ${input.action}`);
        return browserFail(landed.reason, landed.detail);
      }

      if (sideEffecting) {
        // An allow-listed redirect still moves the action off the approved
        // target, so the approval no longer covers what would be submitted.
        if (!sameUrl(page.url, input.targetUrl)) {
          record({
            kind: "action_denied",
            sessionId,
            detail: `target_mismatch: ${input.action} ${input.targetUrl} -> ${page.url}`,
            occurredAt: clock().toISOString(),
          });
          return browserFail(
            "target_mismatch",
            "the page left the approved target URL before the action",
          );
        }

        const before = await capture(session, "before", input.targetUrl);
        if (!before.ok) return before;
        evidence.push(before.value);
      }

      try {
        if (sideEffecting) {
          await deps.driver.perform(input.action as BrowserSideEffectingAction, {
            url: input.targetUrl,
            selector: input.selector ?? null,
            stagedFile: input.stagedFile ?? null,
            sandboxPath: input.sandboxPath ?? null,
          });
          if (session.abortReason !== null) {
            await endSession(session, "aborted", session.abortReason);
            return browserFail("session_aborted", session.abortReason);
          }
        }
      } catch (error) {
        return browserFail(
          error instanceof BrowserDriverError ? error.code : "driver_error",
          "driver refused the action",
        );
      }

      if (sideEffecting) {
        const after = await capture(session, "after", input.targetUrl);
        if (!after.ok) return after;
        evidence.push(after.value);
      }

      session.lastActivityAt = clock().toISOString();
      record({
        kind: "action_completed",
        sessionId,
        detail: `${input.action} ${input.targetUrl}`,
        occurredAt: session.lastActivityAt,
      });
      return browserOk({ url: page.url, evidence });
    },

    async closeSession(sessionId, reason = "closed by caller") {
      const session = sessionOf(sessionId);
      if (session === null) {
        return browserFail("session_ended", "unknown session");
      }
      const result = await endSession(session, "closed", reason);
      return browserOk(result);
    },

    killSwitch(sessionId, reason) {
      const session = sessionOf(sessionId);
      if (session === null) {
        return browserFail("session_ended", "unknown session");
      }
      session.abortReason = reason;
      record({
        kind: "session_aborted",
        sessionId,
        detail: reason,
        occurredAt: clock().toISOString(),
      });
      return browserOk(true as const);
    },

    async purgeTask(taskId) {
      const deleted = await deps.evidenceStore.deleteByTask(taskId);
      if (!deleted.ok) return 0;
      return deleted.deleted;
    },
  };
}

/** Read-only helper used by tests and callers that must never submit. */
export function isReadAction(action: BrowserAction): action is BrowserReadAction {
  return READ_ACTIONS.includes(action as BrowserReadAction);
}

export type BrowserDriverSelectionOptions = Readonly<{
  pages?: Readonly<Record<string, MockPageDefinition>>;
  playwrightLoader?: PlaywrightLoader | null;
}>;

/**
 * Driver selection (DG-01, DG-02). The mock driver is the default and the
 * only driver that runs in `npm test`. `BROWSER_DRIVER=playwright` merely
 * constructs the inert adapter; it still needs an injected loader and
 * installed binaries before anything can launch.
 */
export function selectBrowserDriver(
  environment: Readonly<Record<string, string | undefined>>,
  options: BrowserDriverSelectionOptions = {},
): BrowserDriver {
  if (environment.BROWSER_DRIVER === "playwright") {
    return createPlaywrightDriver({
      loader: options.playwrightLoader ?? null,
    });
  }
  return createMockDriver({ pages: options.pages });
}
