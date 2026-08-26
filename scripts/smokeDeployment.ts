import { inspectDeployment } from "../lib/deploymentSmoke.ts";

const deploymentUrl = process.argv[2];

if (!deploymentUrl) {
  console.error("Usage: npm run smoke:deployment -- https://your-preview.example");
  process.exitCode = 1;
} else {
  try {
    const issues = await inspectDeployment(deploymentUrl);
    if (issues.length > 0) {
      console.error("Deployment smoke test failed:");
      for (const issue of issues) console.error(`- ${issue}`);
      process.exitCode = 1;
    } else {
      console.log("Public deployment smoke checks passed. Complete the authenticated manual checks next.");
    }
  } catch {
    console.error("Deployment smoke test could not run. Check the HTTPS deployment URL and network access.");
    process.exitCode = 1;
  }
}
