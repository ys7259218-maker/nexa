/**
 * B8 threat-matrix integrity check (`npm run check:agent-matrix`).
 *
 * Reads the real working tree: every mapped B1-B7 security test must exist and
 * appear in the `test` script, no known agent security test may be unmapped,
 * and every B8-owned test (including both routes) must exist and be registered.
 * It executes no test and touches no network.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";

import {
  B8_OWN_TEST_FILES,
  THREAT_MATRIX,
  verifyThreatMatrix,
} from "../lib/agent/eval/threatMatrix.ts";

const root = new URL("../", import.meta.url);

function walk(directory: URL, prefix: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(
        ...walk(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`),
      );
    } else if (entry.isFile()) {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files;
}

function registeredTestFiles(): string[] {
  const packageJson = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8"),
  ) as { scripts: Record<string, string> };
  const testScript = packageJson.scripts.test ?? "";
  if (!testScript.startsWith("node --test ")) return [];
  return testScript
    .slice("node --test ".length)
    .trim()
    .split(/\s+/)
    .map((path) => path.replace(/\\/g, "/"))
    .filter((path) => path.length > 0);
}

const agentTests = walk(new URL("lib/agent/", root), "lib/agent/").filter(
  (path) => path.endsWith(".test.ts"),
);

const outsideMapped = THREAT_MATRIX.flatMap((entry) => entry.files).filter(
  (path) => !path.startsWith("lib/agent/"),
);

const existingFiles = [
  ...agentTests,
  ...[...new Set(outsideMapped)].filter((path) =>
    existsSync(new URL(path, root)),
  ),
];

const registered = registeredTestFiles();
const issues = verifyThreatMatrix({
  existingFiles,
  registeredTestFiles: registered,
});

const problems: string[] = issues.map((issue) =>
  issue.path
    ? `${issue.code}: ${issue.id} -> ${issue.path}`
    : `${issue.code}: ${issue.id}`,
);

const registeredSet = new Set(registered);
for (const path of B8_OWN_TEST_FILES) {
  if (!existsSync(new URL(path, root))) {
    problems.push(`b8_missing_file: ${path}`);
  } else if (!registeredSet.has(path)) {
    problems.push(`b8_unregistered_file: ${path}`);
  }
}

if (problems.length > 0) {
  console.error("Agent threat matrix check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Agent threat matrix OK: ${THREAT_MATRIX.length} mapped cases across ${new Set(THREAT_MATRIX.map((entry) => entry.milestone)).size} milestones; ${B8_OWN_TEST_FILES.length} B8 test files registered.`,
  );
}
