/**
 * E.164 recipient-validation for outbound WhatsApp sends.
 *
 * Accepts only bare 7-15 ASCII digits whose first digit is 1-9 (a leading zero
 * is not a valid country-code start, so it is rejected; no leading `+`, spaces,
 * dashes, parentheses, or full-width/Unicode digits). A recipient `wa_id`
 * reported by Meta is already numeric, but outbound sends should reject anything
 * that is not a clean E.164-style string to avoid misrouting a customer number.
 */
export function isValidE164(value: string): boolean {
  // Allow digits only, first digit 1-9 (no leading +, spaces, dashes, parentheses, or leading 0).
  return /^[1-9]\d{6,14}$/.test(value);
}
