import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync } from "node:fs";
import { resolve } from "node:path";

import {
  inspectTrackedFile,
  isFixturePath,
  isTrackedEnvFile,
  type TrackedSecretFinding,
} from "../lib/trackedSecretGuard.ts";

const projectRoot = resolve(import.meta.dirname, "..");

const GIT_CANDIDATES = ["git", "C:/Program Files/Git/cmd/git.exe"];

function resolveGit(): string {
  for (const candidate of GIT_CANDIDATES) {
    if (candidate !== "git" && existsSync(candidate)) return candidate;
  }
  return "git";
}

function listTrackedFiles(): string[] {
  const result = spawnSync(resolveGit(), ["ls-files", "-z"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    console.error(`Tracked-secret guard blocked: git ls-files failed (${result.status}).`);
    process.exit(1);
  }
  return result.stdout.split("\0").filter((path) => path.length > 0);
}

function readTrackedText(path: string): string | undefined {
  try {
    const absolute = resolve(projectRoot, path);
    // A leading NUL byte marks a binary file; secrets do not live there, so the
    // whole asset is never buffered or scanned.
    const handle = openSync(absolute, "r");
    try {
      const probe = new Uint8Array(8192);
      const PROBE_SIZE = 4096;
      const readBytes = readSync(handle, probe, 0, PROBE_SIZE, 0);
      if (readBytes > 0 && probe.subarray(0, readBytes).includes(0)) return undefined;
      return readFileSync(absolute, "utf8");
    } finally {
      closeSync(handle);
    }
  } catch {
    return undefined;
  }
}

function inspectTrackedFiles(paths: string[]): TrackedSecretFinding[] {
  const findings: TrackedSecretFinding[] = [];

  for (const path of paths) {
    // .env.local and other commit-managed env files are flagged by name alone,
    // so their real contents are never buffered or printed.
    if (isTrackedEnvFile(path)) {
      findings.push({ file: path, kind: "tracked-env-file" });
      continue;
    }
    if (isFixturePath(path)) {
      continue;
    }
    const content = readTrackedText(path);
    if (content === undefined) continue;
    findings.push(...inspectTrackedFile(path, content));
  }

  return findings;
}

const findings = inspectTrackedFiles(listTrackedFiles());

if (findings.length > 0) {
  console.error(
    `Tracked-secret guard blocked: ${findings.length} high-confidence finding(s) in tracked files.`,
  );
  for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file))) {
    console.error(`- ${finding.file}: ${finding.kind}`);
  }
  process.exit(1);
}

console.log("Tracked-secret guard passed. No secrets found in tracked files.");