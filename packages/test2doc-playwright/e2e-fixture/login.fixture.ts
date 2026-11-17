/**
 * Fixture, not a test. This stands in for a user's Playwright suite that the
 * test2doc reporter documents. It has no assertions on purpose: it only takes
 * a screenshot the way a real suite would. The assertions live in
 * tests/max-diff-pixel-ratio-e2e.spec.ts, which spawns this suite and checks
 * what the reporter wrote to disk.
 */
import { test } from "@playwright/test"
import { writeFileSync } from "node:fs"
import { screenshot } from "../src/screenshots.js"

// The page only differs between runs by the TEST2DOC_TWEAK env var.
const tweak = process.env.TEST2DOC_TWEAK ?? "none"

const html = `
  <html>
    <body style="margin: 0; padding: 20px; background: white; font: 16px/1.2 sans-serif;">
      <h1 style="margin: 0 0 12px;">Sign in</h1>
      <div style="width: 10px; height: 10px; background: ${
        tweak === "small-badge-color" ? "#d00000" : "#0000d0"
      };"></div>
      <div style="${tweak === "tall-line-spacing" ? "line-height: 3;" : ""}">
        <p>Enter your email address to continue.</p>
        <p>We will never share it with anyone else.</p>
        <p>Forgot your password? Reset it from the link below.</p>
        <p>By signing in you agree to the terms of service.</p>
        <p>Need help? Contact support and we will get back to you.</p>
      </div>
    </body>
  </html>
`

test.describe("Login", () => {
  test("shows the sign in page", async ({ page }, testInfo) => {
    await test.step("Given the user opens the sign in page", async () => {
      await page.setContent(html)
      await screenshot(testInfo, page, {
        annotation: { filename: "login.png" },
      })
    })

    // Keep the raw capture so the driver can measure what really changed.
    const capture = testInfo.attachments.at(-1)?.body
    if (capture && process.env.TEST2DOC_CAPTURE_PATH) {
      writeFileSync(process.env.TEST2DOC_CAPTURE_PATH, capture)
    }
  })
})
