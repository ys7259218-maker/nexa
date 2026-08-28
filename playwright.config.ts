import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.NEXA_SMOKE_BASE_URL ?? "http://127.0.0.1:3111";

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  workers: 1,
  use: {
    baseURL: BASE_URL,
    timezoneId: "UTC",
    screenshot: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
