import { REVIEWED_TOOL_MANIFESTS } from "../tools/manifests.ts";
import { validateManifest } from "../tools/schema.ts";
import {
  toolAdapterKey,
  type ToolManifest,
} from "../tools/types.ts";
import {
  BROWSER_AGENT_FLAG,
  BROWSER_SIDE_EFFECTING_ACTIONS,
} from "./types.ts";

/**
 * B7 browser tool manifests and kill switch.
 *
 * The browser family is additive: when the flag is off (or the build is
 * production) the registry contains exactly the same three B2 manifests as
 * before. Nothing here imports Playwright, opens a socket, or touches a
 * filesystem.
 */

export type BrowserAgentEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type BrowserAgentGateReason = "enabled" | "flag_off" | "production";

export type BrowserAgentGate = {
  enabled: boolean;
  reason: BrowserAgentGateReason;
};

/**
 * B7 kill switch. The only enabling value is the exact string "true"; every
 * absent, empty, ambiguous, or differently-cased value is off. The gate is
 * hard-off in any production build or production Vercel environment.
 */
export function inspectBrowserAgentGate(
  environment: BrowserAgentEnvironment,
): BrowserAgentGate {
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    return { enabled: false, reason: "production" };
  }

  if (environment[BROWSER_AGENT_FLAG] !== "true") {
    return { enabled: false, reason: "flag_off" };
  }

  return { enabled: true, reason: "enabled" };
}

const URL_SCHEMA = {
  type: "string",
  minLength: 8,
  maxLength: 2048,
  pattern: "^https?://[^\\s]+$",
} as const;

const HASH_SCHEMA = {
  type: "string",
  minLength: 64,
  maxLength: 64,
  pattern: "^[0-9a-f]{64}$",
} as const;

const SESSION_ID_SCHEMA = {
  type: "string",
  minLength: 8,
  maxLength: 64,
  pattern: "^bs_[0-9a-f]{16,32}$",
} as const;

const BROWSER_OPEN: ToolManifest = {
  name: "browser.open",
  version: "1.0.0",
  description:
    "Open an allow-listed http(s) page in a disposable browser session. B7 uses a deterministic offline driver by default and never installs a browser.",
  timeoutClass: "standard",
  maxAttempts: 1,
  riskTier: "T1",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["url"],
    properties: {
      url: URL_SCHEMA,
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["sessionId", "url", "title", "redirected"],
    properties: {
      sessionId: SESSION_ID_SCHEMA,
      url: URL_SCHEMA,
      title: {
        type: "string",
        maxLength: 512,
      },
      redirected: {
        type: "boolean",
      },
    },
  },
};

const BROWSER_INSPECT: ToolManifest = {
  name: "browser.inspect",
  version: "1.0.0",
  description:
    "Read a page title, DOM hash and screenshot hash from an open session. Read-only: it cannot submit, upload, or download.",
  timeoutClass: "standard",
  maxAttempts: 1,
  riskTier: "T1",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["sessionId", "url"],
    properties: {
      sessionId: SESSION_ID_SCHEMA,
      url: URL_SCHEMA,
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["url", "title", "redirected", "screenshotHash", "domHash"],
    properties: {
      url: URL_SCHEMA,
      title: {
        type: "string",
        maxLength: 512,
      },
      redirected: {
        type: "boolean",
      },
      screenshotHash: HASH_SCHEMA,
      domHash: HASH_SCHEMA,
    },
  },
};

const BROWSER_ACT: ToolManifest = {
  name: "browser.act",
  version: "1.0.0",
  description:
    "Perform one side-effecting browser action (submit, upload or download). T4: every call needs its own approval bound to the exact session, action and target URL.",
  timeoutClass: "long",
  maxAttempts: 1,
  riskTier: "T4",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["sessionId", "action", "targetUrl", "approvalToken"],
    properties: {
      sessionId: SESSION_ID_SCHEMA,
      action: {
        type: "string",
        enum: [...BROWSER_SIDE_EFFECTING_ACTIONS],
      },
      targetUrl: URL_SCHEMA,
      selector: {
        type: "string",
        minLength: 1,
        maxLength: 512,
      },
      stagedFile: {
        type: "string",
        minLength: 1,
        maxLength: 1024,
      },
      sandboxPath: {
        type: "string",
        minLength: 1,
        maxLength: 1024,
      },
      approvalToken: {
        type: "string",
        minLength: 8,
        maxLength: 128,
        pattern: "^tok_[0-9a-f]{16,64}$",
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["url", "evidence"],
    properties: {
      url: URL_SCHEMA,
      evidence: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 128,
        },
      },
    },
  },
};

export const BROWSER_TOOL_MANIFESTS: readonly ToolManifest[] = [
  BROWSER_OPEN,
  BROWSER_INSPECT,
  BROWSER_ACT,
];

/** Reviewed manifest set for one environment. Off means the B2 family only. */
export function reviewedManifestSet(
  environment: BrowserAgentEnvironment,
): readonly ToolManifest[] {
  if (!inspectBrowserAgentGate(environment).enabled) {
    return REVIEWED_TOOL_MANIFESTS;
  }
  return Object.freeze([...REVIEWED_TOOL_MANIFESTS, ...BROWSER_TOOL_MANIFESTS]);
}

/** Required registry keys for one environment, in manifest order. */
export function requiredToolKeys(
  environment: BrowserAgentEnvironment,
): readonly string[] {
  return reviewedManifestSet(environment).map((manifest) =>
    toolAdapterKey(manifest.name, manifest.version),
  );
}

/** Reviewed hashes for one environment. Throws if a reviewed manifest is invalid. */
export function reviewedManifestHashes(
  environment: BrowserAgentEnvironment,
): ReadonlyMap<string, string> {
  const hashes = new Map<string, string>();
  for (const manifest of reviewedManifestSet(environment)) {
    const validated = validateManifest(manifest);
    if (!validated.ok) {
      throw new Error(
        `reviewed tool manifest ${manifest.name}@${manifest.version} is invalid`,
      );
    }
    hashes.set(toolAdapterKey(manifest.name, manifest.version), validated.hash);
  }
  return hashes;
}
