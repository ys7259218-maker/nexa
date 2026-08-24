import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail, validateAuthInput } from "./authValidation.ts";

test("normalizeEmail trims and lowercases addresses", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
});

test("validateAuthInput rejects malformed and oversized input", () => {
  assert.equal(
    validateAuthInput({ email: "not-an-email", password: "valid-password" }),
    "Enter a valid email address.",
  );
  assert.equal(
    validateAuthInput({ email: `${"a".repeat(250)}@x.com`, password: "valid-password" }),
    "Enter a valid email address.",
  );
  assert.equal(
    validateAuthInput({ email: "user@example.com", password: "x".repeat(129) }),
    "Enter a valid password.",
  );
});

test("signup validation requires a 12-character password", () => {
  assert.equal(
    validateAuthInput(
      { email: "user@example.com", password: "short" },
      { requireStrongPassword: true },
    ),
    "Password must be at least 12 characters.",
  );
  assert.equal(
    validateAuthInput(
      { email: " USER@example.com ", password: "long-password" },
      { requireStrongPassword: true },
    ),
    null,
  );
});
