import { randomUUID } from "node:crypto";

import {
  AGENT_EVAL_FAILURE_CASE_ERROR,
  AGENT_EVAL_FAILURE_CASE_FAILED,
  AGENT_EVAL_FAILURE_NO_SUITES,
  type AgentEvalCase,
  type AgentEvalCaseResult,
  type AgentEvalContext,
  type AgentEvalRunResult,
  type AgentEvalRunner,
  type AgentEvalRunnerOptions,
  type AgentEvalSuiteResult,
} from "./types.ts";

/**
 * Deterministic offline runner.
 *
 * The clock, id factory and suites are injected. Two runs with the same
 * injection produce byte-identical result JSON, because every timestamp and
 * duration comes from the injected clock and every id comes from the injected
 * factory. A throwing case is recorded as an error and never stops the
 * remaining suites.
 */

export class AgentEvalAssertionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "AgentEvalAssertionError";
    this.code = code;
  }
}

function failureCodeOf(error: unknown): string {
  if (error instanceof AgentEvalAssertionError) return error.code;
  return AGENT_EVAL_FAILURE_CASE_ERROR;
}

function makeContext(
  now: () => Date,
  idFactory: () => string,
): AgentEvalContext {
  const fail = (code: string): never => {
    throw new AgentEvalAssertionError(code);
  };

  return {
    now,
    idFactory,
    expect(condition, code) {
      if (!condition) fail(code);
    },
    fail,
  };
}

async function runCase(
  testCase: AgentEvalCase,
  category: AgentEvalCaseResult["category"],
  context: AgentEvalContext,
  now: () => Date,
): Promise<AgentEvalCaseResult> {
  const startedAt = now().getTime();
  let passed = true;
  const failureCodes: string[] = [];

  try {
    await testCase.run(context);
  } catch (error) {
    passed = false;
    failureCodes.push(failureCodeOf(error));
    if (!(error instanceof AgentEvalAssertionError)) {
      failureCodes.push(AGENT_EVAL_FAILURE_CASE_ERROR);
    }
  }

  const durationMs = Math.max(0, now().getTime() - startedAt);

  if (!passed && failureCodes.length === 0) {
    failureCodes.push(AGENT_EVAL_FAILURE_CASE_FAILED);
  }

  return {
    id: testCase.id,
    category,
    passed,
    failureCodes: Object.freeze([...new Set(failureCodes)]),
    durationMs,
  };
}

export function createAgentEvalRunner(
  options: AgentEvalRunnerOptions,
): AgentEvalRunner {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());

  return {
    async run() {
      const startedAt = now().toISOString();
      const context = makeContext(now, idFactory);
      const suites: AgentEvalSuiteResult[] = [];

      for (const suite of options.suites) {
        const cases: AgentEvalCaseResult[] = [];
        for (const testCase of suite.cases) {
          cases.push(await runCase(testCase, suite.category, context, now));
        }

        const failedCases = cases.filter((entry) => !entry.passed).length;
        suites.push({
          id: suite.id,
          category: suite.category,
          passed: failedCases === 0,
          totalCases: cases.length,
          passedCases: cases.length - failedCases,
          failedCases,
          cases: Object.freeze(cases),
        });
      }

      const allCases = suites.flatMap((suite) => suite.cases);
      const failedCases = allCases.filter((entry) => !entry.passed).length;
      const errorCases = allCases.filter((entry) =>
        entry.failureCodes.includes(AGENT_EVAL_FAILURE_CASE_ERROR),
      ).length;

      const failureCodes: string[] = [];
      if (options.suites.length === 0) {
        failureCodes.push(AGENT_EVAL_FAILURE_NO_SUITES);
      }
      if (failedCases > 0) {
        failureCodes.push(AGENT_EVAL_FAILURE_CASE_FAILED);
      }

      return {
        runId: `run_${idFactory()}`,
        startedAt,
        finishedAt: now().toISOString(),
        passed: failureCodes.length === 0,
        failureCodes: Object.freeze([...new Set(failureCodes)]),
        totalCases: allCases.length,
        passedCases: allCases.length - failedCases,
        failedCases,
        errorCases,
        suites: Object.freeze(suites),
      };
    },
  };
}
