/**
 * E.164 recipient-validation for outbound WhatsApp sends.
 *
 * Only outputs boxed, possibly-full-width digits. A recipient `wa_id` reported
 * by Meta is already numeric, but outbound sends should reject anything that is
 * not a clean E.164-style string to avoid misrouting a customer number.
 */
export function isValidE164(value: string): boolean {
  // Allow digits only (no leading +, spaces, dashes, or parentheses).
  return /^\d{7,15}$/.test(value);
}
