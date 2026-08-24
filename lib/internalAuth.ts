import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Validates an exact Bearer token without leaking secret length or prefix
 * information through a naive string comparison.
 */
export function isValidInternalBearer(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret || secret.length < 32 || !authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  const supplied = authorizationHeader.slice("Bearer ".length);
  if (!supplied) return false;

  return timingSafeEqual(digest(supplied), digest(secret));
}

