import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { isValidWhatsAppSignature } from "./whatsapp.ts";

test("accepts a valid Meta webhook signature", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" });
  const secret = "test-app-secret";
  const digest = createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(isValidWhatsAppSignature(body, `sha256=${digest}`, secret), true);
});

test("rejects missing, malformed, and mismatched signatures", () => {
  assert.equal(isValidWhatsAppSignature("{}", null, "secret"), false);
  assert.equal(isValidWhatsAppSignature("{}", "sha1=bad", "secret"), false);
  assert.equal(isValidWhatsAppSignature("{}", `sha256=${"0".repeat(64)}`, "secret"), false);
});
