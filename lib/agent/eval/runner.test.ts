/**
 * B8 eval harness tests (matrix EH-01 … EH-07).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { createInMemoryAgentStore } from "../store.ts";
import { runAgentTaskOnce } from "../runtime.ts";
import { createAgentEvalRunner } from "./runner.ts";
import type { AgentEvalSuite } from "./types.ts";

const evalDir = new URL("./", import.meta.url);

function fixedClock() {
  return () => new Date("2026-11-17T09:00:00.000Z");
}

function fixedIds() {
  let next = 0;
  return () => `eval_id_${(next += 1)}`;
}

function passingSuite(id = "pass-suite"): AgentEvalSuite {
  return {
    id,
    category: "eval_harness",
    cases: [
      {
        id: `${id}-case`,
        run(context) {
          context.expect(true, "never_fails");
        },
      },
    ],
  };
}

test("EH-01 an eval run makes zero fetch calls and needs no hosted URL", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("network is prohibited in eval runs");
  }) as typeof fetch;

  try {
    const result = await createAgentEvalRunner({
      suites: [passingSuite()],
      now: fixedClock(),
      idFactory: fixedIds(),
    }).run();

    assert.equal(result.passed, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EH-02 identical clock and id injection produce byte-identical result JSON", async () => {
  const first = await createAgentEvalRunner({
    suites: [passingSuite("a"), passingSuite("b")],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();
  const second = await createAgentEvalRunner({
    suites: [passingSuite("a"), passingSuite("b")],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.runId, "run_eval_id_1");
});

test("EH-03 eval modules directly import no provider, WhatsApp, calendar, Supabase client or Playwright driver", () => {
  const banned = [
    /whatsapp/i,
    /calendar/i,
    /supabase/i,
    /provider/i,
    /playwright/i,
    /openai/i,
    /anthropic/i,
    /googleapis/i,
    /node:http/,
    /node:https/,
    /node:net/,
    /undici/,
  ];

  const files = readdirSync(evalDir).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );
  assert.ok(files.length >= 4, "expected eval modules");

  for (const file of files) {
    const source = readFileSync(new URL(file, evalDir), "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1] ?? "";
      for (const pattern of banned) {
        assert.ok(
          !pattern.test(specifier),
          `${file} imports banned module ${specifier}`,
        );
      }
    }
  }
});

test("EH-04 a failing suite marks the run failed and keeps per-case codes", async () => {
  const suite: AgentEvalSuite = {
    id: "failing",
    category: "eval_harness",
    cases: [
      {
        id: "case-a",
        run(context) {
          context.expect(false, "fixture_mismatch");
        },
      },
    ],
  };

  const result = await createAgentEvalRunner({
    suites: [suite],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();

  assert.equal(result.passed, false);
  assert.equal(result.failedCases, 1);
  assert.equal(result.failureCodes.includes("case_failed"), true);
  assert.deepEqual(result.suites[0]?.cases[0]?.failureCodes, [
    "fixture_mismatch",
  ]);
});

test("EH-05 a throwing fixture is an error and other suites still run", async () => {
  const throwing: AgentEvalSuite = {
    id: "throwing",
    category: "eval_harness",
    cases: [
      {
        id: "case-throws",
        run() {
          throw new Error("fixture exploded");
        },
      },
    ],
  };

  const result = await createAgentEvalRunner({
    suites: [throwing, passingSuite("after")],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();

  assert.equal(result.passed, false);
  assert.equal(result.errorCases, 1);
  assert.equal(result.suites[1]?.passed, true);
  assert.equal(
    result.suites[0]?.cases[0]?.failureCodes.includes("case_error"),
    true,
  );
});

test("EH-06 result JSON carries ids, counts and codes only", async () => {
  const secret = "CUSTOMER-SECRET-PAGE-CONTENT-123";
  const suite: AgentEvalSuite = {
    id: "content-free",
    category: "eval_harness",
    cases: [
      {
        id: "case-content",
        run(context) {
          // The fixture holds sensitive text; it must never reach the result.
          void secret;
          context.expect(false, "content_mismatch");
        },
      },
    ],
  };

  const result = await createAgentEvalRunner({
    suites: [suite],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();
  const json = JSON.stringify(result);

  assert.equal(json.includes(secret), false);
  assert.equal(json.includes("fixture exploded"), false);
  assert.equal(json.includes("token="), false);
});

test("EH-07 an empty environment completes without a DB or provider attempt", async () => {
  const suite: AgentEvalSuite = {
    id: "empty-env",
    category: "eval_harness",
    cases: [
      {
        id: "case-empty-env",
        async run(context) {
          const store = createInMemoryAgentStore({ now: context.now });
          const result = await runAgentTaskOnce(store, {}, {
            workerId: "worker-eval",
            now: context.now,
          });
          context.expect(
            result.status === "disabled" && result.reason === "flag_off",
            "empty_env_started_runtime",
          );
        },
      },
    ],
  };

  const result = await createAgentEvalRunner({
    suites: [suite],
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();

  assert.equal(result.passed, true);
  assert.equal(result.totalCases, 1);
});
