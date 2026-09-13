import { inspectProductionBuild } from "../lib/productionGuard.ts";

const issues = inspectProductionBuild(process.env);

if (issues.length > 0) {
  console.error("Vercel production build blocked by the production-readiness guard:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Production-readiness guard passed. No values were printed.");
}