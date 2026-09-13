import { basename } from "node:path";

export type TrackedSecretKind = "tracked-env-file" | "private-key" | "high-confidence-token";

export interface TrackedSecretFinding {
  file: string;
  kind: TrackedSecretKind;
}

const ENV_FILE_NAME = /^\.env(\..*)?$/;
const ENV_FILE_ALLOWED = ".env.example";

const FIXTURE_DIRECTORY = /(^|\/)(tests?|fixtures?|__fixtures__)(\/|$)/i;
const FIXTURE_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/i;

const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/;

const PLACEHOLDER_VALUE =
  /(yours?[-_]|your-|example|placeholder|sample[-_]?key|test[-_]?key|xxx|lorem|dummy|choose-|replace-|to[-_]?change)/i;

const TOKEN_PREFIX_RULES = [
  /^sk-[A-Za-z0-9_-]{16,}$/,
  /^sk_live_[A-Za-z0-9]{16,}$/,
  /^rk_live_[A-Za-z0-9]{16,}$/,
  /^whsec_[A-Za-z0-9_-]{16,}$/,
  /^gh[pousr]_[A-Za-z0-9]{20,}$/,
  /^github_pat_[A-Za-z0-9_]{20,}$/,
  /^xox[baprs]-[A-Za-z0-9-]{10,}$/,
  /^AKIA[0-9A-Z]{16}$/,
  /^sb_secret_[A-Za-z0-9]{8,}$/,
] as const;

// Captures a value-like token after `=` or `:` (optionally quoted). This avoids
// flagging bare code identifiers such as startsWith("sb_secret_").
const VALUE_TOKEN_PATTERN =
  /(?:=|:)\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_./+=-]{12,}))[\s,;)}\]]?/g;

const JWT_PATTERN = /^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+$/;

export function isTrackedEnvFile(path: string): boolean {
  const base = basename(path);
  return ENV_FILE_NAME.test(base) && base !== ENV_FILE_ALLOWED;
}

export function isFixturePath(path: string): boolean {
  return FIXTURE_DIRECTORY.test(path) || FIXTURE_FILE.test(path);
}

export function isPublishableSupabaseValue(value: string): boolean {
  return value.startsWith("sb_publishable_");
}

export function isAnonRawJwtToken(value: string): boolean {
  if (!JWT_PATTERN.test(value)) return false;
  try {
    const payload = Buffer.from(value.split(".")[1], "base64url").toString("utf8");
    return JSON.parse(payload).role === "anon";
  } catch {
    return false;
  }
}

export function isHighConfidenceToken(value: string): boolean {
  if (isPublishableSupabaseValue(value)) return false;
  if (PLACEHOLDER_VALUE.test(value)) return false;

  if (JWT_PATTERN.test(value)) {
    // A raw JWT is publishable only when its role claim is anon.
    return !isAnonRawJwtToken(value);
  }

  return TOKEN_PREFIX_RULES.some((rule) => rule.test(value));
}

export function scanContentForSecrets(content: string): TrackedSecretKind[] {
  const findings = new Set<TrackedSecretKind>();

  if (PRIVATE_KEY_BLOCK.test(content)) {
    findings.add("private-key");
  }

  for (const match of content.matchAll(VALUE_TOKEN_PATTERN)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value && isHighConfidenceToken(value)) {
      findings.add("high-confidence-token");
      break;
    }
  }

  return [...findings];
}

export function inspectTrackedFile(path: string, content: string): TrackedSecretFinding[] {
  if (isTrackedEnvFile(path)) {
    return [{ file: path, kind: "tracked-env-file" }];
  }
  if (isFixturePath(path)) {
    return [];
  }
  return scanContentForSecrets(content).map((kind) => ({ file: path, kind }));
}