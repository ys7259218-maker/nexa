/**
 * B8 threat-matrix integrity tests (matrix MT-01 … MT-03).
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  B8_OWN_TEST_FILES,
  THREAT_MATRIX,
  verifyThreatMatrix,
  type ThreatMatrixEntry,
} from "./threatMatrix.ts";

const repoRoot = new URL("../../../", import.meta.url);

function walk(dir: URL, prefix: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    } else if (entry.isFile()) {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files;
}

function actualAgentFiles(): string[] {
  const walked = walk(new URL("lib/agent/", repoRoot), "lib/agent/").filter(
    (path) => path.endsWith(".test.ts"),
  );
  // B6's security tests live in lib/ai/, outside the orphan scan root. Only
  // files that actually exist are passed in, so deleting one still fails as
  // `missing_file` rather than being silently ignored.
  const outside = new Set(
    THREAT_MATRIX.flatMap((entry) => entry.files).filter(
      (path) => !path.startsWith("lib/agent/"),
    ),
  );
  return [
    ...walked,
    ...[...outside].filter((path) => existsSync(new URL(path, repoRoot))),
  ];
}

function registeredTestFiles(): string[] {
  const packageJson = JSON.parse(
    readFileSync(new URL("package.json", repoRoot), "utf8"),
  ) as { scripts: Record<string, string> };
  return packageJson.scripts.test
    .slice("node --test ".length)
    .trim()
    .split(/\s+/)
    .map((path) => path.replace(/\\/g, "/"));
}

const oneEntry: readonly ThreatMatrixEntry[] = [
  { id: "B1-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
];

test("MT-01 a mapped file that does not exist fails the check", () => {
  const issues = verifyThreatMatrix({
    entries: oneEntry,
    existingFiles: ["lib/agent/other.test.ts"],
    registeredTestFiles: ["lib/agent/fsm.test.ts"],
    exemptFiles: ["lib/agent/other.test.ts"],
  });

  assert.deepEqual(issues, [
    {
      code: "missing_file",
      id: "B1-01",
      path: "lib/agent/fsm.test.ts",
    },
  ]);
});

test("MT-02 a mapped file missing from the test script fails the check", () => {
  const issues = verifyThreatMatrix({
    entries: oneEntry,
    existingFiles: ["lib/agent/fsm.test.ts"],
    registeredTestFiles: [],
  });

  assert.deepEqual(issues, [
    {
      code: "unregistered_file",
      id: "B1-01",
      path: "lib/agent/fsm.test.ts",
    },
  ]);
});

test("MT-03 an unmapped security test file is an orphan and fails", () => {
  const issues = verifyThreatMatrix({
    entries: oneEntry,
    existingFiles: ["lib/agent/fsm.test.ts", "lib/agent/rogue.test.ts"],
    registeredTestFiles: [
      "lib/agent/fsm.test.ts",
      "lib/agent/rogue.test.ts",
    ],
    exemptFiles: [],
  });

  assert.deepEqual(issues, [
    {
      code: "orphaned_file",
      id: "lib/agent/rogue.test.ts",
      path: "lib/agent/rogue.test.ts",
    },
  ]);
});

test("MT-03 duplicate, invalid and mismatched case ids fail", () => {
  const entries: ThreatMatrixEntry[] = [
    { id: "B1-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
    { id: "B1-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
    { id: "zz-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
    { id: "B2-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
  ];

  const issues = verifyThreatMatrix({
    entries,
    existingFiles: ["lib/agent/fsm.test.ts"],
    registeredTestFiles: ["lib/agent/fsm.test.ts"],
  });

  assert.deepEqual(
    issues.map((issue) => `${issue.code}:${issue.id}`),
    [
      "duplicate_case_id:B1-01",
      "invalid_case_id:zz-01",
      "mismatched_milestone:B2-01",
    ],
  );
});

test("the shipped B1-B7 matrix maps every agent security test and is registered", () => {
  const issues = verifyThreatMatrix({
    existingFiles: actualAgentFiles(),
    registeredTestFiles: registeredTestFiles(),
  });

  assert.deepEqual(issues, []);
  assert.ok(THREAT_MATRIX.length >= 60, "expected the full B1-B7 map");
  assert.equal(
    new Set(THREAT_MATRIX.map((entry) => entry.id)).size,
    THREAT_MATRIX.length,
  );
  assert.ok(B8_OWN_TEST_FILES.length > 0);
});
