const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

export type AuthInput = { email: string; password: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(emailInput: string): string | null {
  const email = normalizeEmail(emailInput);

  if (!email || email.length > EMAIL_MAX_LENGTH || !/^\S+@\S+\.\S+$/.test(email)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateNewPassword(password: string): string | null {
  if (!password || password.length > PASSWORD_MAX_LENGTH) {
    return "Enter a valid password.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  return null;
}

export function validateAuthInput(
  input: AuthInput,
  options: { requireStrongPassword?: boolean } = {},
): string | null {
  const emailError = validateEmail(input.email);
  if (emailError) {
    return emailError;
  }

  if (!input.password || input.password.length > PASSWORD_MAX_LENGTH) {
    return "Enter a valid password.";
  }

  if (options.requireStrongPassword) {
    return validateNewPassword(input.password);
  }

  return null;
}
