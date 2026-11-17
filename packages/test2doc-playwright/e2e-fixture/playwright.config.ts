import { defineConfig, devices } from "@playwright/test"

/**
 * Config for a real test2doc run, used only by
 * tests/max-diff-pixel-ratio-e2e.spec.ts (which spawns Playwright with it).
 * It lives outside tests/ so the normal integration runs don't pick it up.
 */
const ratio = process.env.TEST2DOC_MAX_DIFF_PIXEL_RATIO

export default defineConfig({
  testDir: ".",
  testMatch: "login.fixture.ts",
  workers: 1,
  reporter: [
    [
      "../src/index.ts",
      {
        outputDir: process.env.TEST2DOC_OUTPUT_DIR,
        maxDiffPixelRatio: ratio === undefined ? undefined : Number(ratio),
      },
    ],
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
