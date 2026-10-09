import { expect, test } from "@playwright/test"
import { withDocMeta } from "@test2doc/playwright/DocMeta"
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"
import { setTabVisibility } from "../src/index.js"
import { injectCode } from "./fixtures.js"

test.describe(
  withDocMeta("Tab visibility", {
    title: "Tab visibility",
    sidebar_position: 3,
    description:
      "Test how your app behaves when the user switches to another tab and comes back.",
  }),
  () => {
    test("Why you need it", async ({ context }, testInfo) => {
      await test.step("Apps often react when the user switches to another tab and comes back.\n", async () => {
        await injectMarkdown(
          testInfo,
          [
            "Polling pauses while the tab is hidden, a live connection closes and reconnects, or data refetches when the user returns (like React Query's `refetchOnWindowFocus`). The browser tells the page through `document.visibilityState` and the `visibilitychange` event.",
            "",
            "Visibility is not the same as focus. The tab is hidden when the user switches to another tab or minimizes the window. Clicking into another app while the window is still on screen only fires `blur`, and the page stays `visible`.",
          ].join("\n"),
        )
      })

      await test.step("Playwright can't hide a tab for real.\n", async () => {
        const first = await context.newPage()
        await first.setContent("<p>First tab</p>")
        const second = await context.newPage()
        await second.setContent("<p>Second tab</p>")
        await second.bringToFront()

        expect(await first.evaluate(() => document.visibilityState)).toBe(
          "visible",
        )
        await injectMarkdown(
          testInfo,
          "Every page stays `visible`, even when you open a second page and bring it to the front. So `visibilitychange` never fires on its own, and `setTabVisibility` fakes it for you. It's separate from the hydration helpers like `clickUntil` and `interactUntil`, which deal with timing, not visibility.",
        )
      })
    })

    test("setTabVisibility", async ({ page }, testInfo) => {
      await test.step("Render a page that reacts to `visibilitychange`, the way code that pauses, reconnects or refetches does.\n", async () => {
        await page.setContent(`
          <p role="status"></p>
          <script>
            document.addEventListener("visibilitychange", () => {
              document.querySelector("[role=status]").textContent =
                document.visibilityState
            })
          </script>
        `)
      })

      await test.step('`setTabVisibility(page, "hidden")` overrides `document.visibilityState` and dispatches `visibilitychange`.\n', async () => {
        await injectCode(
          testInfo,
          `
import { setTabVisibility } from "@test2doc/playwright-utils"

await setTabVisibility(page, "hidden")
`,
        )
        await setTabVisibility(page, "hidden")
        await expect(page.getByRole("status")).toHaveText("hidden")
      })

      await test.step('`setTabVisibility(page, "visible")` brings the tab back.\n', async () => {
        await injectCode(testInfo, `await setTabVisibility(page, "visible")`)
        await setTabVisibility(page, "visible")
        await expect(page.getByRole("status")).toHaveText("visible")
      })
    })
  },
)
