import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;

  const received = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (received.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
