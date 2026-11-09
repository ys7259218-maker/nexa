import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const toolsDir = new URL(".", import.meta.url);

function sourceFiles(): Array<{ name: string; source: string }> {
  return readdirSync(toolsDir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({
      name,
      source: readFileSync(new URL(name, toolsDir), "utf8"),
    }));
}

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "fetch", pattern: /\bfetch\s*\(/ },
  { label: "node:fs", pattern: /from\s+["']node:fs["']/ },
  { label: "node:http", pattern: /from\s+["']node:http["']/ },
  { label: "node:https", pattern: /from\s+["']node:https["']/ },
  { label: "node:net", pattern: /from\s+["']node:net["']/ },
  { label: "node:tls", pattern: /from\s+["']node:tls["']/ },
  { label: "child_process", pattern: /from\s+["']node:child_process["']|require\(["']child_process["']\)/ },
  { label: "axios", pattern: /from\s+["']axios["']/ },
  { label: "undici", pattern: /from\s+["']undici["']/ },
  { label: "googleapis", pattern: /from\s+["']googleapis["']/ },
  { label: "openai", pattern: /from\s+["']openai["']/ },
  { label: "whatsapp", pattern: /from\s+["'][^"']*whatsapp[^"']*["']/i },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { label: "WebSocket", pattern: /\bWebSocket\b/ },
];

test("tool source has no direct network, filesystem, or provider call", () => {
  for (const file of sourceFiles()) {
    for (const forbidden of FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(
        file.source,
        forbidden.pattern,
        `${file.name} contains forbidden ${forbidden.label}`,
      );
    }
  }
});

test("adapters contain no filesystem or network imports", () => {
  const adapters = sourceFiles().find((file) => file.name === "adapters.ts");
  assert.ok(adapters);
  assert.doesNotMatch(adapters.source, /from\s+["']node:/);
  assert.doesNotMatch(adapters.source, /\bfetch\s*\(/);
  assert.doesNotMatch(adapters.source, /\breadFile|\bwriteFile|\bcreateReadStream/);
});

test("executor delegates effects only through the adapter and audit contracts", () => {
  const executor = sourceFiles().find((file) => file.name === "executor.ts");
  assert.ok(executor);
  assert.match(executor.source, /options\.adapters\[/);
  assert.match(executor.source, /options\.auditStore\.record\(/);
  assert.doesNotMatch(executor.source, /\bfetch\s*\(/);
  assert.doesNotMatch(executor.source, /from\s+["']node:/);
});
