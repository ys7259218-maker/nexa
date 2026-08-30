import { runOfflineSafetyEvals } from "../lib/ai/offlineSafetyEvals.ts";

const results = await runOfflineSafetyEvals();
const failed = results.filter((result) => !result.passed);
console.log(`Offline AI safety evaluations: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length > 0) {
  for (const result of failed) console.error(`${result.id}: ${result.failures.join("; ")}`);
  process.exitCode = 1;
}
