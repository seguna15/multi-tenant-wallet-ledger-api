import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "dashboard",
      testMatch: /dashboard\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3000" },
    },
    {
      name: "frontend",
      testMatch: /frontend\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3001" },
    },
  ],
  // Optional: auto-start dev servers when running locally
  webServer: [
    {
      command: "pnpm --filter ledger-api dev",
      url: "http://localhost:8000/api/v1/health",
      timeout: 60_000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter dashboard dev",
      url: "http://localhost:3000",
      timeout: 60_000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter frontend dev",
      url: "http://localhost:3001",
      timeout: 60_000,
      reuseExistingServer: true,
    },
  ],
});
