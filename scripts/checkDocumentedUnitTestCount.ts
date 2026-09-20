import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

const testScript = packageJson.scripts.test;
assert.ok(testScript.startsWith("node --test "), "test script must invoke node --test with an explicit file list");
const testFiles = testScript.slice("node --test ".length).trim().split(/\s+/);
assert.ok(testFiles.length > 0, "test script must list at least one test file");

const results = run({ files: testFiles });
const totals = await new Promise<{ total: number; failures: number }>((resolve, reject) => {
  let total = 0;
  let failures = 0;
  results.on("data", (event: { type?: string }) => {
    if (event.type === "test:pass") total += 1;
    else if (event.type === "test:fail") {
      total += 1;
      failures += 1;
    } else if (event.type === "test:skip" || event.type === "test:todo" || event.type === "test:cancel") {
      total += 1;
    }
  });
  results.on("error", reject);
  results.on("end", () => resolve({ total, failures }));
});

assert.equal(totals.failures, 0, "the run producing the documented test total must be green");
assert.ok(totals.total > 0, "the documented test total must not be zero");

const handoff = readFileSync(new URL("../NEXA_HANDOFF.md", import.meta.url), "utf8");
const goLive = readFileSync(new URL("../docs/GO_LIVE.md", import.meta.url), "utf8");

const handoffMatch = /\((\d+) unit tests passing/.exec(handoff);
assert.ok(handoffMatch, "NEXA_HANDOFF.md must state the passing unit-test total");
assert.equal(
  Number(handoffMatch[1]),
  totals.total,
  `NEXA_HANDOFF.md unit-test total (${handoffMatch[1]}) must equal the runner total at this head (${totals.total})`,
);

const goLiveMatch = /\*\*(\d+)\*\* unit tests/.exec(goLive);
assert.ok(goLiveMatch, "docs/GO_LIVE.md must state the passing unit-test total");
assert.equal(
  Number(goLiveMatch[1]),
  totals.total,
  `docs/GO_LIVE.md unit-test total (${goLiveMatch[1]}) must equal the runner total at this head (${totals.total})`,
);

console.log(
  `documented unit-test total ${totals.total} matches the runner at this head (pass ${totals.total - totals.failures}, fail ${totals.failures})`,
);