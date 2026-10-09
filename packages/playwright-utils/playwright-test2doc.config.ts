import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  reporter: [
    [
      "@test2doc/playwright",
      { outputDir: "../../apps/test2doc-docs/docs/playwright-utils" },
    ],
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
