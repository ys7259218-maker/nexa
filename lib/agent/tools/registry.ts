import { inspectAgentToolRegistryGate } from "./gate.ts";
import {
  REQUIRED_TOOL_KEYS,
  REVIEWED_MANIFEST_HASHES,
  REVIEWED_TOOL_MANIFESTS,
} from "./manifests.ts";
import { validateManifest } from "./schema.ts";
import {
  toolAdapterKey,
  type ToolManifest,
} from "./types.ts";

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type ToolManifestRecord = {
  toolName: string;
  toolVersion: string;
  manifest: unknown;
  manifestHash: string;
  enabled: boolean;
};

export interface ToolManifestStore {
  listManifests(workspaceId: string): Promise<ToolManifestRecord[] | null>;
}

export type ToolRegistry = {
  readonly manifests: readonly ToolManifest[];
  get(name: string, version: string): ToolManifest | null;
  hashFor(name: string, version: string): string | null;
};

export type ToolRegistryLoadReason =
  | "enabled"
  | "flag_off"
  | "production"
  | "invalid_manifest"
  | "duplicate_manifest"
  | "missing_manifest"
  | "unreviewed_manifest"
  | "manifest_hash_mismatch"
  | "manifest_load_error";

export type ToolRegistryLoadResult =
  | { ok: true; registry: ToolRegistry }
  | { ok: false; reason: ToolRegistryLoadReason; errors: string[] };

type ValidatedEntry = {
  manifest: ToolManifest;
  hash: string;
};

function buildRegistry(entries: readonly ValidatedEntry[]): ToolRegistry {
  const byKey = new Map<string, ValidatedEntry>();
  for (const entry of entries) {
    byKey.set(
      toolAdapterKey(entry.manifest.name, entry.manifest.version),
      entry,
    );
  }

  const manifests = Object.freeze(entries.map((entry) => entry.manifest));

  return {
    manifests,
    get(name, version) {
      return byKey.get(toolAdapterKey(name, version))?.manifest ?? null;
    },
    hashFor(name, version) {
      return byKey.get(toolAdapterKey(name, version))?.hash ?? null;
    },
  };
}

/**
 * Hard fail closed: a registry exists only when the kill switch is on and every
 * supplied manifest is valid. There is no partial/best-effort registry.
 */
export function loadToolRegistry(
  environment: Readonly<Record<string, string | undefined>>,
  manifests: readonly unknown[] = REVIEWED_TOOL_MANIFESTS,
  requiredKeys: readonly string[] = REQUIRED_TOOL_KEYS,
): ToolRegistryLoadResult {
  const gate = inspectAgentToolRegistryGate(environment);
  if (!gate.enabled) {
    return {
      ok: false,
      reason: gate.reason,
      errors: [`tool registry ${gate.reason}`],
    };
  }

  const errors: string[] = [];
  const entries: ValidatedEntry[] = [];
  const seen = new Set<string>();

  for (const [index, candidate] of manifests.entries()) {
    const validated = validateManifest(candidate);
    if (!validated.ok) {
      errors.push(
        `manifest[${index}]: ${validated.errors
          .map((entry) => `${entry.path}: ${entry.message}`)
          .join("; ")}`,
      );
      continue;
    }

    const key = toolAdapterKey(
      validated.manifest.name,
      validated.manifest.version,
    );
    if (seen.has(key)) {
      errors.push(`duplicate manifest ${key}`);
      continue;
    }
    seen.add(key);
    entries.push({ manifest: validated.manifest, hash: validated.hash });
  }

  if (errors.length > 0) {
    return { ok: false, reason: "invalid_manifest", errors };
  }

  for (const key of requiredKeys) {
    if (!seen.has(key)) {
      errors.push(`required manifest missing: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, reason: "missing_manifest", errors };
  }

  return { ok: true, registry: buildRegistry(entries) };
}

/**
 * Load the workspace's persisted manifests and prove they are the reviewed
 * documents. A missing, invalid, disabled, unreviewed, or hash-mismatched row
 * fails the whole load.
 */
export async function loadWorkspaceToolRegistry(
  store: ToolManifestStore,
  workspaceId: string,
  environment: Readonly<Record<string, string | undefined>>,
  requiredKeys: readonly string[] = REQUIRED_TOOL_KEYS,
): Promise<ToolRegistryLoadResult> {
  const gate = inspectAgentToolRegistryGate(environment);
  if (!gate.enabled) {
    return {
      ok: false,
      reason: gate.reason,
      errors: [`tool registry ${gate.reason}`],
    };
  }

  let records: ToolManifestRecord[] | null;
  try {
    records = await store.listManifests(workspaceId);
  } catch {
    return {
      ok: false,
      reason: "manifest_load_error",
      errors: ["manifest store threw"],
    };
  }

  if (records === null) {
    return {
      ok: false,
      reason: "manifest_load_error",
      errors: ["manifest store returned an error"],
    };
  }

  const errors: string[] = [];
  const entries: ValidatedEntry[] = [];
  const seen = new Set<string>();

  for (const [index, record] of records.entries()) {
    if (
      typeof record.toolName !== "string" ||
      typeof record.toolVersion !== "string" ||
      typeof record.manifestHash !== "string" ||
      !HASH_PATTERN.test(record.manifestHash) ||
      typeof record.enabled !== "boolean"
    ) {
      errors.push(`manifest row[${index}] has invalid metadata`);
      continue;
    }

    if (!record.enabled) continue;

    const validated = validateManifest(record.manifest);
    if (!validated.ok) {
      errors.push(
        `manifest row[${index}]: ${validated.errors
          .map((entry) => `${entry.path}: ${entry.message}`)
          .join("; ")}`,
      );
      continue;
    }

    const key = toolAdapterKey(record.toolName, record.toolVersion);
    if (
      validated.manifest.name !== record.toolName ||
      validated.manifest.version !== record.toolVersion
    ) {
      errors.push(`manifest row[${index}] name/version mismatch`);
      continue;
    }
    if (validated.hash !== record.manifestHash) {
      errors.push(`manifest row[${index}] hash does not match its document`);
      continue;
    }

    const reviewedHash = REVIEWED_MANIFEST_HASHES.get(key);
    if (reviewedHash === undefined) {
      errors.push(`manifest row[${index}] is not a reviewed tool`);
      continue;
    }
    if (reviewedHash !== record.manifestHash) {
      errors.push(`manifest row[${index}] does not match the reviewed document`);
      continue;
    }

    if (seen.has(key)) {
      errors.push(`duplicate manifest ${key}`);
      continue;
    }
    seen.add(key);
    entries.push({ manifest: validated.manifest, hash: validated.hash });
  }

  if (errors.length > 0) {
    return { ok: false, reason: "invalid_manifest", errors };
  }

  for (const key of requiredKeys) {
    if (!seen.has(key)) {
      errors.push(`required manifest missing: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, reason: "missing_manifest", errors };
  }

  return { ok: true, registry: buildRegistry(entries) };
}
