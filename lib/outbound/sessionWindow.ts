/**
 * WhatsApp outbound session-window and template policy.
 *
 * Encodes Meta's Cloud API delivery rules so the outbound transport never sends
 * a legally-unavailable message:
 *   - Free-form text is only allowed while the 24-hour customer service window
 *     is open for that recipient (i.e. within 24h of their last inbound message).
 *   - Outside the window, only a pre-approved template message is accepted.
 *
 * This is a pure, deterministic policy layer. It is NOT wired into any runtime
 * path in this code-only slice and makes no network calls. It decides *what
 * type of message* may be sent; the transport applies it on integration.
 */

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1_000; // 24 hours

export type AllowedMessageKind = "freeform" | "template";

export interface SessionDecision {
  kind: AllowedMessageKind;
  /** True when the 24-hour service window is open for the recipient. */
  withinWindow: boolean;
}

/**
 * Decide what kind of outbound message is allowed for a recipient given the
 * time of their last inbound message and the current time.
 *
 * - `lastInboundAt` null means we have no record of a customer-initiated message,
 *   so a free-form (unsolicited) reply is NOT permitted — only templates are.
 * - A timestamp older than the 24-hour window also forces template mode.
 */
export function resolveAllowedMessageKind(
  lastInboundAt: string | null,
  now: number | Date = Date.now(),
): SessionDecision {
  const reference = typeof now === "number" ? now : now.getTime();

  if (lastInboundAt == null) {
    return { kind: "template", withinWindow: false };
  }

  const lastInboundMs = Date.parse(lastInboundAt);
  if (Number.isNaN(lastInboundMs)) {
    return { kind: "template", withinWindow: false };
  }

  const withinWindow = reference - lastInboundMs < SERVICE_WINDOW_MS && reference >= lastInboundMs;
  return { kind: withinWindow ? "freeform" : "template", withinWindow };
}

/** Convenience boolean for "may we send a free-form reply to this contact?". */
export function isWithinServiceWindow(
  lastInboundAt: string | null,
  now: number | Date = Date.now(),
): boolean {
  return resolveAllowedMessageKind(lastInboundAt, now).withinWindow;
}

export const MAX_TEMPLATE_NAME_LENGTH = 512;
export const MAX_TEMPLATE_LANGUAGE_LENGTH = 20;
export const MAX_TEMPLATE_PARAMS = 10;
export const MAX_TEMPLATE_PARAM_LENGTH = 500;

export interface TemplateValidationResult {
  valid: boolean;
  reason?: string;
}

function indexOfFirstNonTemplateChar(codePoint: number): number {
  // Allowed: [a-zA-Z0-9_]
  const isAlpha = (codePoint >= 65 && codePoint <= 90) || (codePoint >= 97 && codePoint <= 122);
  const isDigit = codePoint >= 48 && codePoint <= 57;
  return isAlpha || isDigit || codePoint === 95 ? -1 : 0;
}

/**
 * Bound and validate a template message reference. Ensures the template name is
 * a conservative `[A-Za-z0-9_]` identifier (Meta names cannot contain spaces or
 * special characters) and that language + component params are bounded so we
 * never forward unbounded or malicious input toward the transport.
 */
export function validateTemplate(params: {
  name: string;
  language: string;
  componentParams?: string[];
}): TemplateValidationResult {
  const name = params.name.trim();
  const language = params.language.trim();
  const componentParams = params.componentParams ?? [];

  if (name.length === 0) {
    return { valid: false, reason: "empty_template_name" };
  }
  if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
    return { valid: false, reason: "template_name_too_long" };
  }
  for (let i = 0; i < name.length; i += 1) {
    if (indexOfFirstNonTemplateChar(name.codePointAt(i) ?? 0) === 0) {
      return { valid: false, reason: "invalid_template_name" };
    }
  }

  if (language.length === 0) {
    return { valid: false, reason: "empty_template_language" };
  }
  if (language.length > MAX_TEMPLATE_LANGUAGE_LENGTH) {
    return { valid: false, reason: "template_language_too_long" };
  }

  if (componentParams.length > MAX_TEMPLATE_PARAMS) {
    return { valid: false, reason: "template_params_too_many" };
  }
  for (const param of componentParams) {
    if (param.length > MAX_TEMPLATE_PARAM_LENGTH) {
      return { valid: false, reason: "template_param_too_long" };
    }
  }

  return { valid: true };
}
