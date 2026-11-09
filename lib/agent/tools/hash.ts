import { createHash } from "node:crypto";

/**
 * Canonical JSON: recursively sorted object keys and no whitespace. This is
 * the only representation used for manifest and invocation hashes, so key
 * order can never change an approval hash.
 */
export function canonicalJson(value: unknown): string {
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

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashJson(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/**
 * Audit hashing must never throw because the input came from an untrusted
 * caller. The fallback still carries no raw content: it hashes a type marker.
 */
export function hashJsonSafe(value: unknown): string {
  try {
    return hashJson(value);
  } catch {
    return sha256Hex(`unhashable:${typeof value}`);
  }
}
