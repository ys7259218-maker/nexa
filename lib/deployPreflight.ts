const REQUIRED_BROWSER_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const SAFE_BETA_FLAGS = [
  "WHATSAPP_OUTBOUND_ENABLED",
  "EMPLOYEE_LIFECYCLE_ENABLED",
  "AUDIT_LOG_ENABLED",
  "WORKSPACE_SAFETY_ENABLED",
  "TEAM_MANAGEMENT_ENABLED",
  "EMPLOYEE_VERSION_HISTORY_ENABLED",
] as const;

const INBOUND_VARIABLES = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const PLACEHOLDER_PATTERN = /(?:^|[/:._-])(?:your-|choose-|replace-|placeholder)/i;

export type DeployEnvironment = Readonly<Record<string, string | undefined>>;

function valueOf(environment: DeployEnvironment, name: string) {
  return environment[name]?.trim() ?? "";
}

function isPlaceholder(value: string) {
  return value.length === 0 || PLACEHOLDER_PATTERN.test(value);
}

function isSupportedSupabaseBrowserKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  if (value.startsWith("sb_publishable_")) return value.length >= 24;

  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return false;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload !== null && typeof payload === "object" && payload.role === "anon";
  } catch {
    return false;
  }
}

export function inspectClosedBetaEnvironment(environment: DeployEnvironment) {
  const issues: string[] = [];

  for (const name of REQUIRED_BROWSER_VARIABLES) {
    if (isPlaceholder(valueOf(environment, name))) {
      issues.push(`${name} must be configured with a non-placeholder value.`);
    }
  }

  const browserKey = valueOf(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!isPlaceholder(browserKey) && !isSupportedSupabaseBrowserKey(browserKey)) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a Supabase publishable key or a legacy JWT with the anon role.",
    );
  }

  const supabaseUrl = valueOf(environment, "NEXT_PUBLIC_SUPABASE_URL");
  if (supabaseUrl && !PLACEHOLDER_PATTERN.test(supabaseUrl)) {
    try {
      const parsed = new URL(supabaseUrl);
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        issues.push("NEXT_PUBLIC_SUPABASE_URL must be a credential-free HTTPS origin.");
      }
    } catch {
      issues.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
    }
  }

  const provider = valueOf(environment, "AI_PROVIDER").toLowerCase();
  if (provider !== "mock") {
    issues.push("AI_PROVIDER must remain mock for the closed-beta preview gate.");
  }

  for (const name of SAFE_BETA_FLAGS) {
    if (valueOf(environment, name).toLowerCase() !== "false") {
      issues.push(`${name} must be explicitly false for the closed-beta preview gate.`);
    }
  }

  const configuredInboundVariables = INBOUND_VARIABLES.filter(
    (name) => !isPlaceholder(valueOf(environment, name)),
  );
  if (
    configuredInboundVariables.length > 0 &&
    configuredInboundVariables.length !== INBOUND_VARIABLES.length
  ) {
    issues.push(
      "WhatsApp inbound configuration must set WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, and SUPABASE_SERVICE_ROLE_KEY together.",
    );
  }

  const retrySecret = valueOf(environment, "WHATSAPP_RETRY_SECRET");
  if (retrySecret && isPlaceholder(retrySecret)) {
    issues.push("WHATSAPP_RETRY_SECRET must not be a placeholder.");
  } else if (retrySecret && retrySecret.length < 32) {
    issues.push("WHATSAPP_RETRY_SECRET must be empty or at least 32 characters.");
  }

  return issues;
}
