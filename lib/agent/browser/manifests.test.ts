import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  BROWSER_TOOL_MANIFESTS,
  inspectBrowserAgentGate,
  requiredToolKeys,
  reviewedManifestHashes,
  reviewedManifestSet,
} from "./manifests.ts";
import { loadToolRegistry } from "../tools/registry.ts";
import { validateManifest } from "../tools/schema.ts";
import type { ToolCall } from "../tools/permissionTypes.ts";
import { authorize } from "../tools/permissionEngine.ts";
import { createInMemoryPermissionStore } from "../tools/permissionStore.ts";

const BASE_NAMES = ["workspace.file.read", "web.research.search", "calendar.events.read"];
const BROWSER_NAMES = ["browser.open", "browser.inspect", "browser.act"];
const FIXED_NOW = new Date("2026-11-16T10:00:00Z");

const REGISTRY_ON = {
  NODE_ENV: "test",
  AGENT_TOOL_REGISTRY_ENABLED: "true",
} as const;

const BROWSER_ON = {
  ...REGISTRY_ON,
  BROWSER_AGENT_ENABLED: "true",
} as const;

test("MF-01 an unset or false flag keeps every browser manifest out of the registry", () => {
  for (const environment of [
    { NODE_ENV: "test" },
    { NODE_ENV: "test", BROWSER_AGENT_ENABLED: "false" },
    { NODE_ENV: "test", BROWSER_AGENT_ENABLED: "TRUE" },
    { NODE_ENV: "test", BROWSER_AGENT_ENABLED: "1" },
    { NODE_ENV: "production", BROWSER_AGENT_ENABLED: "true" },
    { NODE_ENV: "test", VERCEL_ENV: "production", BROWSER_AGENT_ENABLED: "true" },
  ]) {
    assert.equal(inspectBrowserAgentGate(environment).enabled, false);
    const names = reviewedManifestSet(environment).map((manifest) => manifest.name);
    assert.deepEqual(names, BASE_NAMES);
    assert.equal(names.some((name) => name.startsWith("browser.")), false);
  }

  const loaded = loadToolRegistry(REGISTRY_ON);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.registry.manifests.length, 3);
  assert.equal(loaded.registry.get("browser.act", "1.0.0"), null);
});

test("MF-02 the true flag registers exactly the three hash-verified browser manifests", () => {
  assert.equal(inspectBrowserAgentGate(BROWSER_ON).enabled, true);
  const set = reviewedManifestSet(BROWSER_ON);
  assert.deepEqual(
    set.map((manifest) => manifest.name),
    [...BASE_NAMES, ...BROWSER_NAMES],
  );

  const hashes = reviewedManifestHashes(BROWSER_ON);
  const loaded = loadToolRegistry(BROWSER_ON);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.registry.manifests.length, 6);
  for (const manifest of set) {
    const validated = validateManifest(manifest);
    assert.equal(validated.ok, true);
    if (!validated.ok) continue;
    assert.equal(
      loaded.registry.hashFor(manifest.name, manifest.version),
      hashes.get(`${manifest.name}@${manifest.version}`),
    );
  }
  assert.deepEqual(requiredToolKeys(BROWSER_ON).length, 6);
});

test("MF-03 browser.act is T4 and the policy engine never auto-approves it", async () => {
  const act = BROWSER_TOOL_MANIFESTS.find((manifest) => manifest.name === "browser.act");
  assert.ok(act);
  assert.equal(act.riskTier, "T4");

  const store = createInMemoryPermissionStore({ now: () => FIXED_NOW });
  store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T4",
    toolFamily: "browser.act",
    grantedBy: null,
    scopeNotes: null,
    expiresAt: null,
  });
  const call: ToolCall = {
    workspaceId: "ws-1",
    actor: "user-1",
    toolName: "browser.act",
    toolVersion: "1.0.0",
    toolFamily: "browser.act",
    declaredTier: "T4",
    riskScore: null,
    argsHash: "0".repeat(64),
  };

  const result = await authorize(call, {
    store,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => null,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  });
  assert.equal(result.decision, "CHALLENGE");
  assert.equal(result.requiresApproval, true);
  assert.match(result.reason, /T4/);
});

test("MF-04 no computer-use manifest exists or can register", () => {
  const names = reviewedManifestSet(BROWSER_ON).map((manifest) => manifest.name);
  assert.equal(names.some((name) => /computer|desktop/i.test(name)), false);
  assert.deepEqual(
    BROWSER_TOOL_MANIFESTS.map((manifest) => manifest.name),
    BROWSER_NAMES,
  );

  const act = BROWSER_TOOL_MANIFESTS.find((manifest) => manifest.name === "browser.act");
  assert.ok(act);
  const computer = { ...act, name: "computer.control" };
  const loaded = loadToolRegistry(BROWSER_ON, [computer]);
  assert.equal(loaded.ok, false);
  if (!loaded.ok) assert.equal(loaded.reason, "missing_manifest");
});

test("MF-05 schema drift makes the whole registry refuse to load", () => {
  const open = BROWSER_TOOL_MANIFESTS[0];
  assert.ok(open);

  const driftedTier = { ...open, riskTier: "T5" };
  const tierResult = loadToolRegistry(BROWSER_ON, [driftedTier]);
  assert.equal(tierResult.ok, false);
  if (!tierResult.ok) {
    assert.equal(tierResult.reason, "invalid_manifest");
    assert.match(tierResult.errors.join("\n"), /riskTier/);
  }

  const driftedSchema = { ...open, timeoutClass: "forever" };
  const schemaResult = loadToolRegistry(BROWSER_ON, [driftedSchema]);
  assert.equal(schemaResult.ok, false);
  if (!schemaResult.ok) {
    assert.equal(schemaResult.reason, "invalid_manifest");
    assert.match(schemaResult.errors.join("\n"), /timeoutClass/);
  }
});

test("DG-04 browser modules import no provider, WhatsApp or calendar module", () => {
  const sourceDir = new URL("./", import.meta.url);
  const files = readdirSync(sourceDir).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );
  assert.ok(files.length >= 7);

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(new URL(file, sourceDir), "utf8");
    for (const match of source.matchAll(/^\s*import[\s\S]*?from\s+["']([^"']+)["']/gm)) {
      const specifier = match[1] ?? "";
      if (/whatsapp|calendar|google|provider|openai|anthropic|\/actions\//i.test(specifier)) {
        offenders.push(`${file} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);

  const gatewayFiles = readdirSync(new URL("../../", import.meta.url)).filter((name) =>
    /^(whatsapp|calendar|google)/i.test(name),
  );
  for (const file of gatewayFiles) {
    assert.equal(
      readdirSync(sourceDir).includes(file),
      false,
      `browser module must not shadow ${file}`,
    );
  }
});
