import * as Sentry from "@sentry/nextjs";
import { privacySafeSentryOptions } from "@/lib/sentryMonitoring";

Sentry.init(privacySafeSentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
