import { basename } from "node:path";

export type TrackedSecretKind = "tracked-env-file" | "private-key" | "high-confidence-token";

export interface TrackedSecretFinding {
  file: string;
  kind: TrackedSecretKind;
}

export interface TrackedEntry {
  /** Git index mode as an octal string, e.g. "100644" for a regular file. */
  mode: string;
  /** Git blob SHA of this entry's committed content. */
  sha: string;
  /** Path relative to the repository root, using forward slashes. */
  path: string;
}

/** Reads exact blob content by SHA. Never a working-tree path. */
export type ReadBlob = (sha: string) => string;

const ENV_FILE_NAME = /^\.env(\..*)?$/;
const ENV_FILE_ALLOWED = ".env.example";

// Symbolic link and gitlink (submodule) index modes. Their blobs contain link
// target text or commit SHAs, never file content, so they are never read.
const SYMLINK_MODE = "120000";
const GITLINK_MODE = "160000";

const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/;

// Deliberate placeholder/synthetic values, matched as exact anchored forms so a
// real-looking token is never ignored just because its body happens to contain
// a word like "example" or "dummy". For example "sk_live_exampleRealToken..."
// still matches the sk_live_ rule and is flagged.
const PLACEHOLDER_MARKER =
  /^(?:(?:your|choose|replace|example|sample|placeholder|dummy|lorem|test|synthetic|fixture)[-_][a-z0-9]+(?:[-_][a-z0-9]+)*|to[-_]change(?:[-_][a-z0-9]+)*)$/i;
const PLACEHOLDER_WORD = /^(?:example|examples|sample|placeholder|dummy|lorem|test)$/i;

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

export function isSymbolicEntry(entry: TrackedEntry): boolean {
  return entry.mode === SYMLINK_MODE || entry.mode === GITLINK_MODE;
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

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_WORD.test(value) || PLACEHOLDER_MARKER.test(value);
}

export function isHighConfidenceToken(value: string): boolean {
  if (isPublishableSupabaseValue(value)) return false;
  if (isPlaceholderValue(value)) return false;

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

/**
 * Inspects a single tracked index entry. Symlinks and gitlinks are skipped
 * without reading their blobs; tracked env files are flagged by name alone so
 * their real contents are never buffered or printed; every other regular file,
 * including test and fixture files, is scanned from its exact index blob. A
 * throwing ReadBlob propagates so the caller can fail closed - an undecidable
 * entry is never silently accepted.
 */
export function inspectEntry(entry: TrackedEntry, readBlob: ReadBlob): TrackedSecretFinding[] {
  if (isSymbolicEntry(entry)) return [];
  if (isTrackedEnvFile(entry.path)) {
    return [{ file: entry.path, kind: "tracked-env-file" }];
  }
  return scanContentForSecrets(readBlob(entry.sha)).map((kind) => ({
    file: entry.path,
    kind,
  }));
}