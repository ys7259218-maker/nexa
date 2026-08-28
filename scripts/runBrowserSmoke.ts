import { spawn, type ChildProcess } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = "3111";
const BASE_URL = `http://${HOST}:${PORT}`;

function stopOwnedProcess(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  child.kill();
  child.unref();
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        cache: "no-store",
        redirect: "manual",
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The local process may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Local Nexa smoke server did not become ready in time.");
}

async function main() {
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", HOST, "-p", PORT],
    {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    },
  );

  try {
    await waitForServer();

    const runner = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test"],
      {
        env: { ...process.env, NEXA_SMOKE_BASE_URL: BASE_URL },
        stdio: "inherit",
        windowsHide: true,
      },
    );

    const exitCode = await new Promise<number>((resolve, reject) => {
      runner.once("error", reject);
      runner.once("close", (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } finally {
    stopOwnedProcess(server);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Browser smoke failed.");
  process.exitCode = 1;
});
