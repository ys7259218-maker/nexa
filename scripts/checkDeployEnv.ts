import { inspectClosedBetaEnvironment } from "../lib/deployPreflight.ts";

const issues = inspectClosedBetaEnvironment(process.env);

if (issues.length > 0) {
  console.error("Closed-beta environment preflight failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Closed-beta environment preflight passed. No values were printed.");
}
