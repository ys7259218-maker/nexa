const MAX_DSN_LENGTH = 500;

export function getSafeSentryDsn(value = process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > MAX_DSN_LENGTH) return undefined;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      !parsed.username ||
      parsed.password ||
      !/^\/\d+\/?$/.test(parsed.pathname) ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

export const sentryDsn = getSafeSentryDsn();
export const isSentryEnabled = Boolean(sentryDsn);

export const privacySafeSentryOptions = {
  dsn: sentryDsn,
  enabled: isSentryEnabled,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },
};
