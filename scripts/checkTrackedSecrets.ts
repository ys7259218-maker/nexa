import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  inspectEntry,
  type TrackedEntry,
  type TrackedSecretFinding,
} from "../lib/trackedSecretGuard.ts";

const projectRoot = resolve(import.meta.dirname, "..");

const GIT_CANDIDATES = ["git", "C:/Program Files/Git/cmd/git.exe"];

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

function resolveGit(): string {
  for (const candidate of GIT_CANDIDATES) {
    if (candidate !== "git" && existsSync(candidate)) return candidate;
  }
  return "git";
}

function runGit(args: string[]): Buffer {
  const result = spawnSync(resolveGit(), args, {
    cwd: projectRoot,
    encoding: "buffer",
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result.stdout ?? Buffer.alloc(0);
}

function listTrackedEntries(): TrackedEntry[] {
  const raw = runGit(["ls-files", "-s", "-z"]).toString("utf8");
  const entries: TrackedEntry[] = [];
  for (const record of raw.split("\0")) {
    if (record.length === 0) continue;
    const tab = record.indexOf("\t");
    if (tab === -1) continue;
    const [mode, sha] = record.slice(0, tab).split(" ");
    if (!mode || !sha) continue;
    entries.push({ mode, sha, path: record.slice(tab + 1) });
  }
  return entries;
}

function readBlob(sha: string): string {
  const blob = runGit(["cat-file", "blob", sha]);
  // A leading NUL byte marks a binary blob. Secrets do not live in binary
  // assets, so the whole blob is never buffered as text or scanned.
  const probeLength = Math.min(blob.length, 8192);
  if (blob.subarray(0, probeLength).includes(0)) return "";
  return blob.toString("utf8");
}

function inspectTrackedEntries(entries: TrackedEntry[]): TrackedSecretFinding[] {
  const findings: TrackedSecretFinding[] = [];
  for (const entry of entries) {
    try {
      // Symbolic entries (symlinks, submodule gitlinks) are skipped without
      // reading; tracked env files are flagged by name alone so their real
      // contents are never buffered or printed; every other tracked file is
      // scanned from the exact blob git committed - never a working-tree path.
      findings.push(...inspectEntry(entry, readBlob));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Tracked-secret guard blocked: failed to inspect ${entry.path}. ${detail}`);
      process.exit(1);
    }
  }
  return findings;
}

try {
  const findings = inspectTrackedEntries(listTrackedEntries());

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
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Tracked-secret guard blocked: ${detail}`);
  process.exit(1);
}