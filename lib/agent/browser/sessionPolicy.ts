import { isIP } from "node:net";
import { hashJson } from "../tools/hash.ts";
import {
  BROWSER_DEFAULT_PORTS,
  type BrowserFailureReason,
} from "./types.ts";

/**
 * Default-deny navigation policy (draft scope C2, matrix SP-01 … SP-09).
 *
 * Rules, in order:
 * 1. The URL must parse and use http/https. `javascript:`, `data:`, `file:`
 *    and `blob:` never reach the driver.
 * 2. Embedded credentials are refused; they would also make the origin
 *    ambiguous in the approval prompt.
 * 3. An empty allow-list denies everything.
 * 4. IP literals are refused outright, even when listed: a tenant must use a
 *    name. Resolved addresses are checked separately when a resolver is
 *    supplied, which is the DNS-rebinding guard.
 * 5. Only reviewed ports are accepted.
 * 6. The host must match an allow-list entry exactly, or match a wildcard
 *    entry (`*.example.com`) as a real subdomain. A wildcard never matches the
 *    apex, and an unlisted sibling subdomain never inherits the parent.
 */

export type HostResolver = (
  host: string,
) => Promise<readonly string[]> | readonly string[];

export type BrowserSessionPolicy = Readonly<{
  workspaceId: string;
  allowList: readonly string[];
  allowedPorts: readonly number[];
  resolver: HostResolver | null;
}>;

export type BrowserSessionPolicyInput = Readonly<{
  workspaceId: string;
  allowList: readonly string[];
  allowedPorts?: readonly number[];
  resolver?: HostResolver | null;
}>;

export type AllowListEntry = Readonly<{
  raw: string;
  kind: "exact" | "wildcard";
  host: string;
}>;

export type BrowserAllowedNavigation = Readonly<{
  allowed: true;
  url: string;
  scheme: "http" | "https";
  host: string;
  port: number;
  matchedEntry: string;
  resolvedAddresses: readonly string[];
}>;

export type BrowserDeniedNavigation = Readonly<{
  allowed: false;
  url: string;
  reason: BrowserFailureReason;
  detail: string;
}>;

export type BrowserNavigationDecision =
  | BrowserAllowedNavigation
  | BrowserDeniedNavigation;

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

function normaliseHost(host: string): string {
  const trimmed = host.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseAllowListEntry(raw: string): AllowListEntry | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // A credential, scheme, path, port or whitespace inside an entry is not a
  // host. Drop it rather than guess, so the entry can never match.
  if (/[\s/@:#?]/.test(trimmed)) return null;

  const wildcard = trimmed.startsWith("*.");
  const host = normaliseHost(wildcard ? trimmed.slice(2) : trimmed);
  if (host.length === 0 || !HOST_PATTERN.test(host) || isIP(host) !== 0) {
    return null;
  }
  return { raw: trimmed, kind: wildcard ? "wildcard" : "exact", host };
}

export function createSessionPolicy(
  input: BrowserSessionPolicyInput,
): BrowserSessionPolicy {
  const entries = input.allowList
    .map((entry) => parseAllowListEntry(entry))
    .filter((entry): entry is AllowListEntry => entry !== null);
  const seen = new Set<string>();
  const allowList: string[] = [];
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allowList.push(entry.kind === "wildcard" ? `*.${entry.host}` : entry.host);
  }

  const ports = (input.allowedPorts ?? BROWSER_DEFAULT_PORTS).filter(
    (port) => Number.isInteger(port) && port > 0 && port <= 65_535,
  );

  return Object.freeze({
    workspaceId: input.workspaceId,
    allowList: Object.freeze(allowList),
    allowedPorts: Object.freeze([...new Set(ports)]),
    resolver: input.resolver ?? null,
  });
}

export function policyHash(policy: BrowserSessionPolicy): string {
  return hashJson({
    workspaceId: policy.workspaceId,
    allowList: policy.allowList,
    allowedPorts: policy.allowedPorts,
    resolveTimeCheck: policy.resolver !== null,
  });
}

function matchAllowList(
  host: string,
  policy: BrowserSessionPolicy,
): AllowListEntry | null {
  for (const raw of policy.allowList) {
    const entry = parseAllowListEntry(raw);
    if (entry === null) continue;
    if (entry.kind === "exact" && entry.host === host) return entry;
    if (
      entry.kind === "wildcard" &&
      host.endsWith(`.${entry.host}`) &&
      host !== entry.host
    ) {
      return entry;
    }
  }
  return null;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

export function isPrivateOrReservedAddress(address: string): boolean {
  const normalised = address.trim().toLowerCase();
  const version = isIP(normalised);
  if (version === 4) return isPrivateIpv4(normalised);
  if (version !== 6) return true; // unparseable address fails closed

  if (normalised === "::" || normalised === "::1") return true;
  if (normalised.startsWith("::ffff:")) {
    return isPrivateIpv4(normalised.slice("::ffff:".length));
  }
  if (normalised.startsWith("fc") || normalised.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalised)) return true;
  if (normalised.startsWith("ff")) return true; // multicast
  return false;
}

function resolvePort(parsed: URL): number {
  if (parsed.port.length > 0) return Number(parsed.port);
  return parsed.protocol === "https:" ? 443 : 80;
}

async function resolveHost(
  host: string,
  policy: BrowserSessionPolicy,
): Promise<
  | { ok: true; addresses: readonly string[] }
  | { ok: false; reason: BrowserFailureReason; detail: string }
> {
  if (policy.resolver === null) {
    return { ok: true, addresses: [] };
  }
  try {
    const addresses = await policy.resolver(host);
    return { ok: true, addresses: addresses.map((entry) => entry.trim()) };
  } catch {
    return {
      ok: false,
      reason: "resolver_error",
      detail: "host resolution failed, refusing to navigate",
    };
  }
}

export async function evaluateNavigation(
  policy: BrowserSessionPolicy,
  rawUrl: string,
): Promise<BrowserNavigationDecision> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      url: rawUrl,
      reason: "invalid_url",
      detail: "url did not parse",
    };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "scheme_not_allowed",
      detail: `scheme ${parsed.protocol} is not http or https`,
    };
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "credentials_in_url",
      detail: "url embeds credentials",
    };
  }

  if (policy.allowList.length === 0) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "empty_allow_list",
      detail: "no host is allow-listed for this workspace",
    };
  }

  const host = normaliseHost(parsed.hostname);
  if (isIP(host) !== 0) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "ip_literal",
      detail: "ip literals are never navigable",
    };
  }

  const port = resolvePort(parsed);
  if (!policy.allowedPorts.includes(port)) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "port_not_allowed",
      detail: `port ${port} is outside the reviewed set`,
    };
  }

  const entry = matchAllowList(host, policy);
  if (entry === null) {
    return {
      allowed: false,
      url: rawUrl,
      reason: "host_not_allowed",
      detail: `${host} is not on the workspace allow-list`,
    };
  }

  const resolved = await resolveHost(host, policy);
  if (!resolved.ok) {
    return {
      allowed: false,
      url: rawUrl,
      reason: resolved.reason,
      detail: resolved.detail,
    };
  }
  if (resolved.addresses.length > 0) {
    const blocked = resolved.addresses.find((address) =>
      isPrivateOrReservedAddress(address),
    );
    if (blocked !== undefined) {
      return {
        allowed: false,
        url: rawUrl,
        reason: "private_address",
        detail: `${host} resolves to a private or reserved address`,
      };
    }
  }

  return {
    allowed: true,
    url: parsed.toString(),
    scheme: parsed.protocol === "https:" ? "https" : "http",
    host,
    port,
    matchedEntry: entry.kind === "wildcard" ? `*.${entry.host}` : entry.host,
    resolvedAddresses: resolved.addresses,
  };
}

/**
 * Redirect guard (SP-06): every hop is evaluated before the browser is allowed
 * to render it. The first off-list hop stops the chain.
 */
export async function evaluateRedirectChain(
  policy: BrowserSessionPolicy,
  hops: readonly string[],
): Promise<BrowserNavigationDecision> {
  if (hops.length === 0) {
    return {
      allowed: false,
      url: "",
      reason: "invalid_url",
      detail: "empty redirect chain",
    };
  }

  let last: BrowserNavigationDecision | null = null;
  for (const [index, hop] of hops.entries()) {
    const decision = await evaluateNavigation(policy, hop);
    if (!decision.allowed) {
      if (index === 0) return decision;
      return {
        allowed: false,
        url: hop,
        reason: "redirect_off_list",
        detail: `redirect hop ${index} is refused: ${decision.reason}`,
      };
    }
    last = decision;
  }

  return last as BrowserNavigationDecision;
}
