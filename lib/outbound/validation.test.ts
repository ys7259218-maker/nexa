import assert from "node:assert/strict";
import test from "node:test";

import { isValidE164 } from "./validation.ts";

const VALID = [
  "1234567",
  "12345678",
  "15551234567",
  "912345678901234",
];

test("isValidE164 accepts 7-15 ASCII digits with a 1-9 leading digit", () => {
  for (const value of VALID) {
    assert.equal(isValidE164(value), true, `${value} must be accepted`);
  }
});

test("isValidE164 rejects a leading plus", () => {
  assert.equal(isValidE164("+15551234567"), false);
  assert.equal(isValidE164("+1234567"), false);
});

test("isValidE164 rejects a leading zero at min, normal, and max lengths", () => {
  assert.equal(isValidE164("0234567"), false);
  assert.equal(isValidE164("015551234567"), false);
  assert.equal(isValidE164("012345678901234"), false);
});

test("isValidE164 rejects separators and phone-formatting punctuation", () => {
  const withSeparators = ["155-5123-4567", "1555 123 4567", "(555)1234567", "1555.123.4567"];
  for (const value of withSeparators) {
    assert.equal(isValidE164(value), false, `${value} must be rejected`);
  }
});

test("isValidE164 rejects non-ASCII and full-width digits", () => {
  const unicodeDigits = [
    "１２３４５６７８",
    "1234567８",
    "١٢٣٤٥٦٧",
    "१२३४५६७",
  ];
  for (const value of unicodeDigits) {
    assert.equal(isValidE164(value), false, `${value} must be rejected`);
  }
});

test("isValidE164 rejects too-short, too-long, empty, and letter strings", () => {
  assert.equal(isValidE164("123456"), false);
  assert.equal(isValidE164("1234567890123456"), false);
  assert.equal(isValidE164(""), false);
  assert.equal(isValidE164("abc"), false);
});