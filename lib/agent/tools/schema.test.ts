import assert from "node:assert/strict";
import test from "node:test";

import { hashJson } from "./hash.ts";
import { REVIEWED_TOOL_MANIFESTS } from "./manifests.ts";
import {
  validateManifest,
  validateToolInput,
  validateToolOutput,
} from "./schema.ts";

const fileManifest = REVIEWED_TOOL_MANIFESTS.find(
  (manifest) => manifest.name === "workspace.file.read",
)!;
const webManifest = REVIEWED_TOOL_MANIFESTS.find(
  (manifest) => manifest.name === "web.research.search",
)!;
const calendarManifest = REVIEWED_TOOL_MANIFESTS.find(
  (manifest) => manifest.name === "calendar.events.read",
)!;

function inputPaths(input: unknown): string[] {
  return validateToolInput(fileManifest, input).map((entry) => entry.path);
}

test("all reviewed manifests pass strict validation", () => {
  for (const manifest of REVIEWED_TOOL_MANIFESTS) {
    const result = validateManifest(manifest);
    assert.equal(result.ok, true, manifest.name);
    if (result.ok) {
      assert.match(result.hash, /^[0-9a-f]{64}$/);
    }
  }
});

test("unknown manifest fields are rejected", () => {
  const result = validateManifest({
    ...fileManifest,
    hiddenSideEffect: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.errors.some((entry) => entry.path === "manifest.hiddenSideEffect"),
    );
  }
});

test("unknown input and output fields are rejected", () => {
  assert.deepEqual(inputPaths({ path: "notes.txt" }), []);
  assert.deepEqual(inputPaths({ path: "notes.txt", extra: true }), [
    "input.extra",
  ]);

  const output = validateToolOutput(fileManifest, {
    path: "notes.txt",
    contentHash: "a".repeat(64),
    byteLength: 17,
    mediaType: "text/plain",
    extra: true,
  });
  assert.deepEqual(output.map((entry) => entry.path), ["output.extra"]);
});

test("types, bounds, patterns, and enums are enforced", () => {
  assert.ok(inputPaths({ path: 7 }).length > 0);
  assert.ok(inputPaths({ path: "../secret.txt" }).length > 0);
  assert.ok(inputPaths({ path: "/etc/passwd" }).length > 0);
  assert.ok(inputPaths({ path: "a.txt", maxBytes: 0 }).length > 0);
  assert.ok(inputPaths({ path: "a.txt", maxBytes: 2_000_000 }).length > 0);
  assert.ok(
    inputPaths({ path: "a.txt", maxBytes: 1.5 }).some((path) =>
      path.includes("maxBytes"),
    ),
  );

  const badMediaType = validateToolOutput(fileManifest, {
    path: "a.txt",
    contentHash: "a".repeat(64),
    byteLength: 17,
    mediaType: "text/html",
  });
  assert.ok(badMediaType.some((entry) => entry.path === "output.mediaType"));
});

test("malformed schemas are rejected instead of best-effort executed", () => {
  const missingAdditionalProperties = validateManifest({
    ...fileManifest,
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: { path: { type: "string" } },
    },
  });
  assert.equal(missingAdditionalProperties.ok, false);

  const unknownKeyword = validateManifest({
    ...fileManifest,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string", minLenght: 1 },
      },
    },
  });
  assert.equal(unknownKeyword.ok, false);

  const invalidPattern = validateManifest({
    ...fileManifest,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string", pattern: "[" },
      },
    },
  });
  assert.equal(invalidPattern.ok, false);
});

test("date-time and https URI formats are enforced", () => {
  const invalidTime = validateToolInput(calendarManifest, {
    timeMin: "not-a-date",
    timeMax: "2026-11-09T10:00:00.000Z",
  });
  assert.ok(invalidTime.some((entry) => entry.path === "input.timeMin"));

  const validTime = validateToolInput(calendarManifest, {
    timeMin: "2026-11-09T09:00:00.000Z",
    timeMax: "2026-11-09T10:00:00.000Z",
  });
  assert.deepEqual(validTime, []);

  const httpUrl = validateToolOutput(webManifest, {
    queryHash: "a".repeat(64),
    results: [
      {
        title: "result",
        url: "http://example.invalid/result",
        snippetHash: "b".repeat(64),
      },
    ],
  });
  assert.ok(httpUrl.some((entry) => entry.path === "output.results[0].url"));
});

test("canonical hashes ignore object key order", () => {
  assert.equal(
    hashJson({ b: 1, a: { d: 2, c: 3 } }),
    hashJson({ a: { c: 3, d: 2 }, b: 1 }),
  );

  const reordered = {
    outputSchema: fileManifest.outputSchema,
    inputSchema: fileManifest.inputSchema,
    riskTier: fileManifest.riskTier,
    maxAttempts: fileManifest.maxAttempts,
    timeoutClass: fileManifest.timeoutClass,
    description: fileManifest.description,
    version: fileManifest.version,
    name: fileManifest.name,
  };
  const left = validateManifest(fileManifest);
  const right = validateManifest(reordered);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  if (left.ok && right.ok) {
    assert.equal(left.hash, right.hash);
  }
});

test("schema nesting is bounded", () => {
  let nested: Record<string, unknown> = { type: "string" };
  for (let index = 0; index < 10; index += 1) {
    nested = {
      type: "object",
      additionalProperties: false,
      properties: { child: nested },
    };
  }

  const result = validateManifest({
    ...fileManifest,
    inputSchema: nested,
  });
  assert.equal(result.ok, false);
});

test("deterministic fuzz corpus never throws", () => {
  let state = 0x1234_5678;
  function next(): number {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  }

  function randomValue(depth: number): unknown {
    const pick = Math.floor(next() * 6);
    if (depth > 4 || pick === 0) return next() < 0.5 ? "text" : next() * 1000;
    if (pick === 1) return next() < 0.5;
    if (pick === 2) return null;
    if (pick === 3) {
      return Array.from({ length: Math.floor(next() * 4) }, () =>
        randomValue(depth + 1),
      );
    }
    return {
      path: randomValue(depth + 1),
      extra: randomValue(depth + 1),
    };
  }

  for (let index = 0; index < 200; index += 1) {
    const value = randomValue(0);
    assert.doesNotThrow(() => validateToolInput(fileManifest, value));
    assert.doesNotThrow(() => validateManifest(value));
    assert.doesNotThrow(() =>
      validateToolOutput(webManifest, { results: [value] }),
    );
  }
});
