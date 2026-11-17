/**
 * Phase B B8 deterministic offline evaluation contracts.
 *
 * The eval harness is content-free by construction: a result carries ids,
 * counts and failure codes only. Fixtures live in code, never in output, and
 * nothing here reaches a provider, the network, a hosted database or a real
 * browser.
 */

export const AGENT_EVAL_CATEGORIES = [
  "eval_harness",
  "scenario",
  "threat_matrix",
  "verify_evidence",
  "observability",
  "watchdog",
] as const;

export type AgentEvalCategory = (typeof AGENT_EVAL_CATEGORIES)[number];

export type AgentEvalAssertion = (condition: boolean, code: string) => void;

export type AgentEvalContext = Readonly<{
  now: () => Date;
  idFactory: () => string;
  expect: AgentEvalAssertion;
  fail: (code: string) => never;
}>;

export type AgentEvalCase = Readonly<{
  id: string;
  run: (context: AgentEvalContext) => Promise<void> | void;
}>;

export type AgentEvalSuite = Readonly<{
  id: string;
  category: AgentEvalCategory;
  cases: readonly AgentEvalCase[];
}>;

export type AgentEvalCaseResult = Readonly<{
  id: string;
  category: AgentEvalCategory;
  passed: boolean;
  failureCodes: readonly string[];
  durationMs: number;
}>;

export type AgentEvalSuiteResult = Readonly<{
  id: string;
  category: AgentEvalCategory;
  passed: boolean;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  cases: readonly AgentEvalCaseResult[];
}>;

export type AgentEvalRunResult = Readonly<{
  runId: string;
  startedAt: string;
  finishedAt: string;
  passed: boolean;
  failureCodes: readonly string[];
  totalCases: number;
  passedCases: number;
  failedCases: number;
  errorCases: number;
  suites: readonly AgentEvalSuiteResult[];
}>;

export type AgentEvalRunnerOptions = Readonly<{
  suites: readonly AgentEvalSuite[];
  now?: () => Date;
  idFactory?: () => string;
}>;

export type AgentEvalRunner = Readonly<{
  run: () => Promise<AgentEvalRunResult>;
}>;

export const AGENT_EVAL_FAILURE_CASE_FAILED = "case_failed";
export const AGENT_EVAL_FAILURE_CASE_ERROR = "case_error";
export const AGENT_EVAL_FAILURE_NO_SUITES = "no_suites";
