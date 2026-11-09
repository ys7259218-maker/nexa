import { validateManifest } from "./schema.ts";
import type { ToolManifest } from "./types.ts";
import { toolAdapterKey } from "./types.ts";

/**
 * Reviewed first-family manifests. Every manifest is strict: object schemas
 * reject unknown fields, paths cannot escape workspace storage, web results
 * are read-only, and calendar output is gated by an injected read gate.
 */

const WORKSPACE_FILE_READ: ToolManifest = {
  name: "workspace.file.read",
  version: "1.0.0",
  description:
    "Read metadata for a file inside the current workspace storage sandbox. B2 returns deterministic mock metadata only.",
  timeoutClass: "fast",
  maxAttempts: 1,
  riskTier: "T1",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: {
        type: "string",
        minLength: 1,
        maxLength: 512,
        pattern: "^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._/-]+$",
      },
      maxBytes: {
        type: "integer",
        minimum: 1,
        maximum: 1_048_576,
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "contentHash", "byteLength", "mediaType"],
    properties: {
      path: {
        type: "string",
        minLength: 1,
        maxLength: 512,
      },
      contentHash: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      byteLength: {
        type: "integer",
        minimum: 0,
        maximum: 1_048_576,
      },
      mediaType: {
        type: "string",
        enum: ["text/plain", "application/octet-stream"],
      },
    },
  },
};

const WEB_RESEARCH_SEARCH: ToolManifest = {
  name: "web.research.search",
  version: "1.0.0",
  description:
    "Read-only research search contract. B2 returns deterministic mock results with reserved .invalid URLs and never calls the network.",
  timeoutClass: "standard",
  maxAttempts: 2,
  riskTier: "T1",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 200,
      },
      maxResults: {
        type: "integer",
        minimum: 1,
        maximum: 10,
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["queryHash", "results"],
    properties: {
      queryHash: {
        type: "string",
        pattern: "^[0-9a-f]{64}$",
      },
      results: {
        type: "array",
        minItems: 0,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "snippetHash"],
          properties: {
            title: {
              type: "string",
              minLength: 1,
              maxLength: 200,
            },
            url: {
              type: "string",
              minLength: 1,
              maxLength: 2_048,
              pattern: "^https://",
              format: "uri",
            },
            snippetHash: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
          },
        },
      },
    },
  },
};

const CALENDAR_EVENTS_READ: ToolManifest = {
  name: "calendar.events.read",
  version: "1.0.0",
  description:
    "Read-only calendar events contract. B2 returns deterministic mock events only when the injected calendar read gate is open; it never calls Google or OAuth.",
  timeoutClass: "standard",
  maxAttempts: 1,
  riskTier: "T1",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["timeMin", "timeMax"],
    properties: {
      timeMin: {
        type: "string",
        format: "date-time",
      },
      timeMax: {
        type: "string",
        format: "date-time",
      },
      maxResults: {
        type: "integer",
        minimum: 1,
        maximum: 50,
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["calendarId", "events"],
    properties: {
      calendarId: {
        type: "string",
        minLength: 3,
        maxLength: 255,
        pattern: "^[A-Za-z0-9._+@-]{3,255}$",
      },
      events: {
        type: "array",
        minItems: 0,
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["eventId", "startsAt", "endsAt", "summaryHash"],
          properties: {
            eventId: {
              type: "string",
              minLength: 1,
              maxLength: 255,
            },
            startsAt: {
              type: "string",
              format: "date-time",
            },
            endsAt: {
              type: "string",
              format: "date-time",
            },
            summaryHash: {
              type: "string",
              pattern: "^[0-9a-f]{64}$",
            },
          },
        },
      },
    },
  },
};

export const REVIEWED_TOOL_MANIFESTS: readonly ToolManifest[] = [
  WORKSPACE_FILE_READ,
  WEB_RESEARCH_SEARCH,
  CALENDAR_EVENTS_READ,
];

export const REQUIRED_TOOL_KEYS: readonly string[] = REVIEWED_TOOL_MANIFESTS.map(
  (manifest) => toolAdapterKey(manifest.name, manifest.version),
);

function buildReviewedHashes(): ReadonlyMap<string, string> {
  const hashes = new Map<string, string>();
  for (const manifest of REVIEWED_TOOL_MANIFESTS) {
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

export const REVIEWED_MANIFEST_HASHES: ReadonlyMap<string, string> =
  buildReviewedHashes();

export function getReviewedManifest(
  name: string,
  version: string,
): ToolManifest | null {
  return (
    REVIEWED_TOOL_MANIFESTS.find(
      (manifest) => manifest.name === name && manifest.version === version,
    ) ?? null
  );
}
