import { expect, test } from "@playwright/test"
import { withDocMeta } from "@test2doc/playwright/DocMeta"
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"
import type { RoleSelector } from "../src/index.js"
import { injectCode } from "./fixtures.js"

const selectors = {
  buttonSave: ["button", { name: "Save" }],
} satisfies Record<string, RoleSelector>

test.describe(
  withDocMeta("Typed role selectors", {
    title: "Typed role selectors",
    sidebar_position: 4,
    description:
      "Keep getByRole selectors in one typed map with the RoleSelector type.",
  }),
  () => {
    test("RoleSelector", async ({ page }, testInfo) => {
      await test.step("Use `RoleSelector` to keep selectors in one typed map.\n", async () => {
        await injectMarkdown(
          testInfo,
          '`RoleSelector` is shorthand for `Parameters<Page["getByRole"]>`, the type behind the selector tuple pattern. Selector tuples work on their own or alongside page objects, as the selectors a page object uses. For more on the pattern, see [Selector Tuple: An alternative to Page Object Model](/blog/selector-tuple-vs-page-object-model).',
        )
        await injectCode(
          testInfo,
          `
import type { RoleSelector } from "@test2doc/playwright-utils"

export const selectors = {
  buttonSave: ["button", { name: "Save" }],
} satisfies Record<string, RoleSelector>
`,
        )
      })

      await test.step("Spread an entry into `getByRole`.\n", async () => {
        await page.setContent("<button>Save</button>")
        await injectCode(
          testInfo,
          "await page.getByRole(...selectors.buttonSave).click()",
        )
        await expect(page.getByRole(...selectors.buttonSave)).toBeVisible()
      })
    })
  },
)
