/**
 * Phase B B7 browser-integration contracts.
 *
 * Everything here is offline and deterministic. The module knows nothing about
 * a real browser, a network socket, a provider, WhatsApp, or a calendar. The
 * only driver that runs by default is the mock driver; the Playwright adapter
 * is inert unless a caller injects a loader and selects it explicitly.
 */

export const BROWSER_AGENT_FLAG = "BROWSER_AGENT_ENABLED";

export const BROWSER_DRIVER_FLAG = "BROWSER_DRIVER";

export const BROWSER_DRIVER_KINDS = ["mock", "playwright"] as const;

export type BrowserDriverKind = (typeof BROWSER_DRIVER_KINDS)[number];

export const BROWSER_TOOL_NAMES = [
  "browser.open",
  "browser.inspect",
  "browser.act",
] as const;

export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];

export const BROWSER_READ_ACTIONS = ["navigate", "screenshot", "dom_read"] as const;

export const BROWSER_SIDE_EFFECTING_ACTIONS = [
  "submit",
  "upload",
  "download",
] as const;

export const BROWSER_ACTIONS = [
  ...BROWSER_READ_ACTIONS,
  ...BROWSER_SIDE_EFFECTING_ACTIONS,
] as const;

export type BrowserReadAction = (typeof BROWSER_READ_ACTIONS)[number];

export type BrowserSideEffectingAction =
  (typeof BROWSER_SIDE_EFFECTING_ACTIONS)[number];

export type BrowserAction = (typeof BROWSER_ACTIONS)[number];

/** Reviewed defaults. A caller may lower them, never raise them silently. */
export const BROWSER_SESSION_TTL_MS = 10 * 60_000;

export const BROWSER_SESSION_IDLE_MS = 2 * 60_000;

export const BROWSER_APPROVAL_TTL_MS = 2 * 60_000;

export const BROWSER_DEFAULT_PORTS = [443, 80] as const;

export const BROWSER_SANDBOX_PREFIX = "sandbox://";

export const BROWSER_STAGING_PREFIX = "staging://";

export type BrowserFailureReason =
  | "browser_disabled"
  | "browser_unavailable"
  | "invalid_url"
  | "scheme_not_allowed"
  | "credentials_in_url"
  | "empty_allow_list"
  | "host_not_allowed"
  | "port_not_allowed"
  | "ip_literal"
  | "private_address"
  | "resolver_error"
  | "redirect_off_list"
  | "session_expired"
  | "session_ended"
  | "session_aborted"
  | "missing_approval"
  | "approval_denied"
  | "approval_expired"
  | "approval_revoked"
  | "target_mismatch"
  | "approval_store_error"
  | "upload_source_not_staged"
  | "download_destination_not_sandbox"
  | "evidence_write_failed"
  | "teardown_failed"
  | "driver_error";

export type BrowserResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: BrowserFailureReason; detail: string };

export function browserFail<T>(
  reason: BrowserFailureReason,
  detail: string,
): BrowserResult<T> {
  return { ok: false, reason, detail };
}

export function browserOk<T>(value: T): BrowserResult<T> {
  return { ok: true, value };
}

export function isBrowserAction(value: unknown): value is BrowserAction {
  return BROWSER_ACTIONS.includes(value as BrowserAction);
}

export function isSideEffectingAction(
  value: BrowserAction,
): value is BrowserSideEffectingAction {
  return BROWSER_SIDE_EFFECTING_ACTIONS.includes(
    value as BrowserSideEffectingAction,
  );
}

export function isBrowserDriverKind(
  value: unknown,
): value is BrowserDriverKind {
  return BROWSER_DRIVER_KINDS.includes(value as BrowserDriverKind);
}

/** Plain-language action labels used in the approval prompt. */
export const BROWSER_ACTION_LABELS: Readonly<
  Record<BrowserSideEffectingAction, string>
> = {
  submit: "submit the form",
  upload: "upload the selected file",
  download: "download the file",
};

export type BrowserDriverPage = Readonly<{
  url: string;
  title: string;
  redirected: boolean;
  redirectChain: readonly string[];
}>;

export type BrowserDriverScreenshot = Readonly<{
  bytes: Uint8Array;
  mediaType: "image/png";
}>;

export type BrowserDriverDom = Readonly<{
  bytes: Uint8Array;
  mediaType: "text/html";
}>;

/**
 * The only surface the service uses. A driver that cannot satisfy a call must
 * throw `BrowserDriverError`; it may never pretend success.
 */
export interface BrowserDriver {
  readonly kind: BrowserDriverKind;
  open(url: string): Promise<BrowserDriverPage>;
  screenshot(): Promise<BrowserDriverScreenshot>;
  domSnapshot(): Promise<BrowserDriverDom>;
  perform(
    action: BrowserSideEffectingAction,
    target: Readonly<{
      url: string;
      selector: string | null;
      stagedFile: string | null;
      sandboxPath: string | null;
    }>,
  ): Promise<Readonly<{ url: string; performed: true }>>;
  close(): Promise<void>;
  wipeProfile(): Promise<void>;
  /** Test-visible: no file may remain in the ephemeral profile. */
  profileFileCount(): number;
  /** Test-visible: must stay 0 for the offline contract. */
  socketsOpened(): number;
}

export class BrowserDriverError extends Error {
  readonly code: BrowserFailureReason;

  constructor(code: BrowserFailureReason, message: string = code) {
    super(message);
    this.name = "BrowserDriverError";
    this.code = code;
  }
}
