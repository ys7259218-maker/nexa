import assert from "node:assert/strict";
import test from "node:test";

import { validateManifest } from "./schema.ts";
import {
  REQUIRED_TOOL_KEYS,
  REVIEWED_TOOL_MANIFESTS,
} from "./manifests.ts";
import {
  loadToolRegistry,
  loadWorkspaceToolRegistry,
  type ToolManifestRecord,
  type ToolManifestStore,
} from "./registry.ts";
import { toolAdapterKey } from "./types.ts";

const enabled = { AGENT_TOOL_REGISTRY_ENABLED: "true" };

function recordFor(manifest: unknown): ToolManifestRecord {
  const validated = validateManifest(manifest);
  if (!validated.ok) throw new Error("test manifest is invalid");
  return {
    toolName: validated.manifest.name,
    toolVersion: validated.manifest.version,
    manifest,
    manifestHash: validated.hash,
    enabled: true,
  };
}

function reviewedRecords(): ToolManifestRecord[] {
  return REVIEWED_TOOL_MANIFESTS.map(recordFor);
}

test("kill switch is exact-true and hard-off in production", () => {
  const absent = loadToolRegistry({});
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.reason, "flag_off");

  const ambiguous = loadToolRegistry({
    AGENT_TOOL_REGISTRY_ENABLED: "TRUE",
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.reason, "flag_off");

  const production = loadToolRegistry({
    NODE_ENV: "production",
    AGENT_TOOL_REGISTRY_ENABLED: "true",
  });
  assert.equal(production.ok, false);
  if (!production.ok) assert.equal(production.reason, "production");

  const vercelProduction = loadToolRegistry({
    VERCEL_ENV: "production",
    AGENT_TOOL_REGISTRY_ENABLED: "true",
  });
  assert.equal(vercelProduction.ok, false);
  if (!vercelProduction.ok) assert.equal(vercelProduction.reason, "production");
});

test("enabled registry loads exactly the reviewed manifests", () => {
  const loaded = loadToolRegistry(enabled);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;

  assert.equal(loaded.registry.manifests.length, 3);
  for (const key of REQUIRED_TOOL_KEYS) {
    const [name, version] = key.split("@");
    const manifest = loaded.registry.get(name, version);
    assert.ok(manifest);
    assert.match(loaded.registry.hashFor(name, version) ?? "", /^[0-9a-f]{64}$/);
  }
  assert.equal(loaded.registry.get("workspace.file.read", "9.9.9"), null);
  assert.equal(loaded.registry.hashFor("workspace.file.read", "9.9.9"), null);
});

test("missing required manifest fails the whole registry", () => {
  const loaded = loadToolRegistry(enabled, [REVIEWED_TOOL_MANIFESTS[0]]);
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.reason, "missing_manifest");
    assert.ok(loaded.errors.some((entry) => entry.includes("required manifest")));
  }
});

test("one invalid manifest fails the whole registry", () => {
  const tampered = {
    ...REVIEWED_TOOL_MANIFESTS[0],
    hiddenSideEffect: true,
  };
  const loaded = loadToolRegistry(enabled, [
    tampered,
    REVIEWED_TOOL_MANIFESTS[1],
    REVIEWED_TOOL_MANIFESTS[2],
  ]);
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.reason, "invalid_manifest");
    assert.ok(loaded.errors.some((entry) => entry.includes("unknown manifest field")));
  }
});

test("duplicate manifest versions are rejected", () => {
  const loaded = loadToolRegistry(enabled, [
    REVIEWED_TOOL_MANIFESTS[0],
    REVIEWED_TOOL_MANIFESTS[0],
    REVIEWED_TOOL_MANIFESTS[1],
    REVIEWED_TOOL_MANIFESTS[2],
  ]);
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.ok(loaded.errors.some((entry) => entry.includes("duplicate manifest")));
  }
});

test("kill-switch drill: disabled workspace load never touches the store", async () => {
  let called = false;
  const store: ToolManifestStore = {
    async listManifests() {
      called = true;
      throw new Error("store must not be touched");
    },
  };

  const loaded = await loadWorkspaceToolRegistry(store, "workspace-a", {});
  assert.equal(loaded.ok, false);
  if (!loaded.ok) assert.equal(loaded.reason, "flag_off");
  assert.equal(called, false);
});

test("workspace registry loads only reviewed, hash-matched manifests", async () => {
  const store: ToolManifestStore = {
    async listManifests() {
      return reviewedRecords();
    },
  };
  const loaded = await loadWorkspaceToolRegistry(store, "workspace-a", enabled);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;

  assert.equal(loaded.registry.manifests.length, 3);
  assert.ok(loaded.registry.get("calendar.events.read", "1.0.0"));
});

test("workspace registry fails closed on empty, errored, or missing stores", async () => {
  const empty = await loadWorkspaceToolRegistry(
    { async listManifests() { return []; } },
    "workspace-a",
    enabled,
  );
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.reason, "missing_manifest");

  const errored = await loadWorkspaceToolRegistry(
    { async listManifests() { return null; } },
    "workspace-a",
    enabled,
  );
  assert.equal(errored.ok, false);
  if (!errored.ok) assert.equal(errored.reason, "manifest_load_error");

  const thrown = await loadWorkspaceToolRegistry(
    {
      async listManifests() {
        throw new Error("database unavailable");
      },
    },
    "workspace-a",
    enabled,
  );
  assert.equal(thrown.ok, false);
  if (!thrown.ok) assert.equal(thrown.reason, "manifest_load_error");
});

test("workspace registry rejects hash drift and unreviewed tools", async () => {
  const records = reviewedRecords();
  const hashDrift = records.map((record, index) =>
    index === 0 ? { ...record, manifestHash: "a".repeat(64) } : record,
  );
  const drifted = await loadWorkspaceToolRegistry(
    { async listManifests() { return hashDrift; } },
    "workspace-a",
    enabled,
  );
  assert.equal(drifted.ok, false);
  if (!drifted.ok) assert.equal(drifted.reason, "invalid_manifest");

  const customManifest = {
    ...REVIEWED_TOOL_MANIFESTS[0],
    name: "custom.tool",
  };
  const unreviewed = [...records, recordFor(customManifest)];
  const extra = await loadWorkspaceToolRegistry(
    { async listManifests() { return unreviewed; } },
    "workspace-a",
    enabled,
  );
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.reason, "invalid_manifest");
});

test("workspace registry skips disabled rows and then reports the missing tool", async () => {
  const records = reviewedRecords().map((record, index) =>
    index === 0 ? { ...record, enabled: false } : record,
  );
  const loaded = await loadWorkspaceToolRegistry(
    { async listManifests() { return records; } },
    "workspace-a",
    enabled,
  );
  assert.equal(loaded.ok, false);
  if (!loaded.ok) assert.equal(loaded.reason, "missing_manifest");
});

test("workspace registry key list matches the reviewed tool keys", () => {
  assert.deepEqual(
    REQUIRED_TOOL_KEYS,
    REVIEWED_TOOL_MANIFESTS.map((manifest) =>
      toolAdapterKey(manifest.name, manifest.version),
    ),
  );
});
