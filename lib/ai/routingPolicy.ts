/**
 * Phase B B6: Model routing policy and deterministic fallback ladder.
 *
 * Routes chat completions to model providers by task class (planning, chat,
 * extraction, embedding) with cost/latency classes. Falls back deterministically
 * to a cheaper secondary provider, then to mock-with-degraded-limitations.
 * Mock fallback is always safe-terminal: it never silently "acts smart".
 *
 * Zero new dependencies. Additive only — does not modify existing provider
 * files or the draft pipeline.
 */

export type TaskClass =
  | "planning"
  | "chat"
  | "extraction"
  | "embedding";

export type CostClass = "low" | "medium" | "high";
export type LatencyClass = "fast" | "standard" | "slow";

export interface ModelRoute {
  provider: "mock" | "openai" | "openai-compatible";
  model: string | null;
  costClass: CostClass;
  latencyClass: LatencyClass;
  enabled: boolean;
}

export interface RouteEntry {
  taskClass: TaskClass;
  primary: ModelRoute;
  secondary: ModelRoute | null;
  fallback: "mock"; // always safe-terminal
}

export interface RoutingPolicy {
  routes: Map<TaskClass, RouteEntry>;
  defaultRoute: RouteEntry;
}

export interface RoutingDecision {
  route: RouteEntry;
  usedFallback: boolean;
  reason: string;
}

export interface ModelCapabilities {
  supportsToolCalls: boolean;
  supportsStructuredOutput: boolean;
  maxContextTokens: number;
}

export const DEFAULT_ROUTE: RouteEntry = {
  taskClass: "chat",
  primary: {
    provider: "mock",
    model: null,
    costClass: "low",
    latencyClass: "fast",
    enabled: true,
  },
  secondary: null,
  fallback: "mock",
};

export function defaultPolicy(): RoutingPolicy {
  const routes = new Map<TaskClass, RouteEntry>([
    [
      "planning",
      {
        taskClass: "planning",
        primary: {
          provider: "mock",
          model: null,
          costClass: "low",
          latencyClass: "fast",
          enabled: true,
        },
        secondary: null,
        fallback: "mock",
      },
    ],
    [
      "chat",
      {
        taskClass: "chat",
        primary: {
          provider: "mock",
          model: null,
          costClass: "low",
          latencyClass: "fast",
          enabled: true,
        },
        secondary: null,
        fallback: "mock",
      },
    ],
    [
      "extraction",
      {
        taskClass: "extraction",
        primary: {
          provider: "mock",
          model: null,
          costClass: "low",
          latencyClass: "fast",
          enabled: true,
        },
        secondary: null,
        fallback: "mock",
      },
    ],
    [
      "embedding",
      {
        taskClass: "embedding",
        primary: {
          provider: "mock",
          model: null,
          costClass: "low",
          latencyClass: "fast",
          enabled: true,
        },
        secondary: null,
        fallback: "mock",
      },
    ],
  ]);
  return { routes, defaultRoute: DEFAULT_ROUTE };
}

export function routeFor(
  policy: RoutingPolicy,
  taskClass: TaskClass,
): RouteEntry {
  return policy.routes.get(taskClass) ?? policy.defaultRoute;
}

export function decideRoute(
  policy: RoutingPolicy,
  taskClass: TaskClass,
): RoutingDecision {
  const route = routeFor(policy, taskClass);

  // Primary route must be enabled to be used.
  if (route.primary.enabled) {
    return { route, usedFallback: false, reason: "primary" };
  }

  // Secondary route if primary is disabled.
  if (route.secondary !== null && route.secondary.enabled) {
    return { route, usedFallback: true, reason: "secondary" };
  }

  // Always fall back to mock — safe-terminal, never silently "acts smart".
  return {
    route,
    usedFallback: true,
    reason: "mock-fallback",
  };
}

export function defaultModelCapabilities(): ModelCapabilities {
  return {
    supportsToolCalls: false,
    supportsStructuredOutput: false,
    maxContextTokens: 4096,
  };
}

export function modelCapabilitiesFor(route: RouteEntry): ModelCapabilities {
  if (route.primary.provider === "mock") {
    return {
      supportsToolCalls: false,
      supportsStructuredOutput: false,
      maxContextTokens: 4096,
    };
  }
  return defaultModelCapabilities();
}
