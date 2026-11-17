/**
 * Phase B B8 threat-matrix map (matrix C3, MT-01 … MT-03).
 *
 * B7 shipped per-case security IDs (SP/EV/AP/SL/MF/DG). B1-B6 never had
 * per-case IDs, so this map assigns stable milestone-scoped IDs to the test
 * files that already prove those contracts. The map is data only: the check
 * never executes a test, it only proves that every mapped file exists and is
 * registered, and that no known security test file is left unmapped.
 */

export const THREAT_MATRIX_MILESTONES = [
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
] as const;

export type ThreatMatrixMilestone = (typeof THREAT_MATRIX_MILESTONES)[number];

export type ThreatMatrixEntry = Readonly<{
  id: string;
  milestone: ThreatMatrixMilestone;
  files: readonly string[];
}>;

export const THREAT_MATRIX_CASE_ID_PATTERN =
  /^(?:B[1-7]-\d{2}|(?:SP|EV|AP|SL|MF|DG)-\d{2})$/;

const B7_PREFIXES = ["SP", "EV", "AP", "SL", "MF", "DG"] as const;

/** Tests added by B8 itself; they are mapped by the B8 matrix, not B1-B7. */
export const B8_OWN_TEST_FILES: readonly string[] = [
  "lib/agent/eval/runner.test.ts",
  "lib/agent/eval/scenarios.test.ts",
  "lib/agent/eval/threatMatrix.test.ts",
  "lib/agent/observability/gate.test.ts",
  "lib/agent/observability/metrics.test.ts",
  "lib/agent/observability/watchdog.test.ts",
  "lib/agent/verify/evidenceChecks.test.ts",
  "app/api/agent/observability/summary/route.test.ts",
  "app/api/agent/observability/watchdog/route.test.ts",
];

export const THREAT_MATRIX: readonly ThreatMatrixEntry[] = [
  { id: "B1-01", milestone: "B1", files: ["lib/agent/fsm.test.ts"] },
  { id: "B1-02", milestone: "B1", files: ["lib/agent/gate.test.ts"] },
  { id: "B1-03", milestone: "B1", files: ["lib/agent/events.test.ts"] },
  { id: "B1-04", milestone: "B1", files: ["lib/agent/runtime.test.ts"] },
  {
    id: "B1-05",
    milestone: "B1",
    files: ["lib/agent/migrationContract.test.ts"],
  },

  { id: "B2-01", milestone: "B2", files: ["lib/agent/tools/schema.test.ts"] },
  { id: "B2-02", milestone: "B2", files: ["lib/agent/tools/registry.test.ts"] },
  { id: "B2-03", milestone: "B2", files: ["lib/agent/tools/executor.test.ts"] },
  { id: "B2-04", milestone: "B2", files: ["lib/agent/tools/adapters.test.ts"] },
  { id: "B2-05", milestone: "B2", files: ["lib/agent/tools/boundary.test.ts"] },
  {
    id: "B2-06",
    milestone: "B2",
    files: ["lib/agent/tools/migrationContract.test.ts"],
  },

  {
    id: "B3-01",
    milestone: "B3",
    files: ["lib/agent/tools/permissionGate.test.ts"],
  },
  {
    id: "B3-02",
    milestone: "B3",
    files: ["lib/agent/tools/riskScoring.test.ts"],
  },
  {
    id: "B3-03",
    milestone: "B3",
    files: ["lib/agent/tools/permissionStore.test.ts"],
  },
  {
    id: "B3-04",
    milestone: "B3",
    files: ["lib/agent/tools/permissionEngine.test.ts"],
  },
  {
    id: "B3-05",
    milestone: "B3",
    files: ["lib/agent/tools/credentialBroker.test.ts"],
  },

  {
    id: "B4-01",
    milestone: "B4",
    files: ["lib/agent/planner/plannerGate.test.ts"],
  },
  {
    id: "B4-02",
    milestone: "B4",
    files: ["lib/agent/planner/plannerStore.test.ts"],
  },
  {
    id: "B4-03",
    milestone: "B4",
    files: ["lib/agent/planner/contextPacker.test.ts"],
  },
  {
    id: "B4-04",
    milestone: "B4",
    files: ["lib/agent/planner/stepScheduler.test.ts"],
  },
  {
    id: "B4-05",
    milestone: "B4",
    files: ["lib/agent/planner/checkpointGate.test.ts"],
  },
  {
    id: "B4-06",
    milestone: "B4",
    files: ["lib/agent/planner/stepExecutor.test.ts"],
  },

  {
    id: "B5-01",
    milestone: "B5",
    files: ["lib/agent/memory/memoryGate.test.ts"],
  },
  {
    id: "B5-02",
    milestone: "B5",
    files: ["lib/agent/memory/memoryStore.test.ts"],
  },
  {
    id: "B5-03",
    milestone: "B5",
    files: ["lib/agent/memory/memoryConsentService.test.ts"],
  },
  {
    id: "B5-04",
    milestone: "B5",
    files: ["lib/agent/memory/memorySessionService.test.ts"],
  },
  {
    id: "B5-05",
    milestone: "B5",
    files: ["lib/agent/memory/memoryTaskService.test.ts"],
  },
  {
    id: "B5-06",
    milestone: "B5",
    files: ["lib/agent/memory/memoryUserApprovedFactsService.test.ts"],
  },
  {
    id: "B5-07",
    milestone: "B5",
    files: ["lib/agent/memory/memoryExternalDataRefsService.test.ts"],
  },

  { id: "B6-01", milestone: "B6", files: ["lib/ai/chatModel.test.ts"] },
  { id: "B6-02", milestone: "B6", files: ["lib/ai/routingPolicy.test.ts"] },
  { id: "B6-03", milestone: "B6", files: ["lib/ai/usageLedger.test.ts"] },
  { id: "B6-04", milestone: "B6", files: ["lib/ai/circuitBreaker.test.ts"] },

  {
    id: "SP-01",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-02",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-03",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-04",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-05",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-06",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-07",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-08",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },
  {
    id: "SP-09",
    milestone: "B7",
    files: ["lib/agent/browser/sessionPolicy.test.ts"],
  },

  {
    id: "EV-01",
    milestone: "B7",
    files: ["lib/agent/browser/evidence.test.ts"],
  },
  {
    id: "EV-02",
    milestone: "B7",
    files: ["lib/agent/browser/evidence.test.ts"],
  },
  {
    id: "EV-03",
    milestone: "B7",
    files: ["lib/agent/browser/evidence.test.ts"],
  },
  {
    id: "EV-04",
    milestone: "B7",
    files: ["lib/agent/browser/evidence.test.ts"],
  },
  {
    id: "EV-05",
    milestone: "B7",
    files: ["lib/agent/browser/evidence.test.ts"],
  },

  {
    id: "AP-01",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-02",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-03",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-04",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-05",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-06",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-07",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },
  {
    id: "AP-08",
    milestone: "B7",
    files: ["lib/agent/browser/approvalGate.test.ts"],
  },

  {
    id: "SL-01",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "SL-02",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "SL-03",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "SL-04",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "SL-05",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "SL-06",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },

  {
    id: "MF-01",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },
  {
    id: "MF-02",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },
  {
    id: "MF-03",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },
  {
    id: "MF-04",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },
  {
    id: "MF-05",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },

  {
    id: "DG-01",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "DG-02",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "DG-03",
    milestone: "B7",
    files: ["lib/agent/browser/browserService.test.ts"],
  },
  {
    id: "DG-04",
    milestone: "B7",
    files: ["lib/agent/browser/manifests.test.ts"],
  },
];

export const THREAT_MATRIX_ISSUE_CODES = [
  "missing_file",
  "unregistered_file",
  "orphaned_file",
  "duplicate_case_id",
  "invalid_case_id",
  "mismatched_milestone",
] as const;

export type ThreatMatrixIssueCode = (typeof THREAT_MATRIX_ISSUE_CODES)[number];

export type ThreatMatrixIssue = Readonly<{
  code: ThreatMatrixIssueCode;
  id: string;
  path?: string;
}>;

export type ThreatMatrixInput = Readonly<{
  entries?: readonly ThreatMatrixEntry[];
  existingFiles: readonly string[];
  registeredTestFiles: readonly string[];
  exemptFiles?: readonly string[];
}>;

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
}

function milestoneOfId(id: string): ThreatMatrixMilestone | null {
  if (/^B[1-7]-\d{2}$/.test(id)) {
    return id.slice(0, 2) as ThreatMatrixMilestone;
  }
  const prefix = id.slice(0, 2);
  if ((B7_PREFIXES as readonly string[]).includes(prefix)) return "B7";
  return null;
}

/**
 * Pure integrity check. No test is executed and no file is read: callers pass
 * the actual file list and the registered `test` script entries.
 */
export function verifyThreatMatrix(
  input: ThreatMatrixInput,
): readonly ThreatMatrixIssue[] {
  const entries = input.entries ?? THREAT_MATRIX;
  const existing = new Set(input.existingFiles.map(normalize));
  const registered = new Set(input.registeredTestFiles.map(normalize));
  const exempt = new Set(
    (input.exemptFiles ?? B8_OWN_TEST_FILES).map(normalize),
  );
  const issues: ThreatMatrixIssue[] = [];
  const seenIds = new Set<string>();
  const coveredFiles = new Set<string>();

  for (const entry of entries) {
    if (!THREAT_MATRIX_CASE_ID_PATTERN.test(entry.id)) {
      issues.push({ code: "invalid_case_id", id: entry.id });
      continue;
    }
    if (seenIds.has(entry.id)) {
      issues.push({ code: "duplicate_case_id", id: entry.id });
    }
    seenIds.add(entry.id);

    const expectedMilestone = milestoneOfId(entry.id);
    if (expectedMilestone !== entry.milestone) {
      issues.push({ code: "mismatched_milestone", id: entry.id });
    }

    for (const rawPath of entry.files) {
      const path = normalize(rawPath);
      coveredFiles.add(path);
      if (!existing.has(path)) {
        issues.push({ code: "missing_file", id: entry.id, path });
      } else if (!registered.has(path)) {
        issues.push({ code: "unregistered_file", id: entry.id, path });
      }
    }
  }

  for (const rawPath of input.existingFiles) {
    const path = normalize(rawPath);
    if (exempt.has(path)) continue;
    if (!path.startsWith("lib/agent/") || !path.endsWith(".test.ts")) continue;
    if (!coveredFiles.has(path)) {
      issues.push({ code: "orphaned_file", id: path, path });
    }
  }

  return Object.freeze(issues);
}
