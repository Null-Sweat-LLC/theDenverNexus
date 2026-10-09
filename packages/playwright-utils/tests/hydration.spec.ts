import { expect, test } from "@playwright/test"
import { withDocMeta } from "@test2doc/playwright/DocMeta"
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"
import {
  clickUntil,
  fillWithChange,
  interactUntil,
  selectWithChange,
} from "../src/index.js"
import {
  HYDRATION_DELAY_MS,
  hydrateLater,
  injectCode,
  trackValue,
} from "./fixtures.js"

test.describe(
  withDocMeta("Hydration-safe interactions", {
    title: "Hydration-safe interactions",
    sidebar_position: 2,
    description:
      "Click, fill and select reliably in server-rendered React apps, even before hydration finishes.",
  }),
  () => {
    test.describe("The problem", () => {
      test("A click before hydration does nothing", async ({
        page,
      }, testInfo) => {
        await test.step("A server-rendered button is visible and clickable before React hydrates and attaches its `onClick`.\n", async () => {
          await page.setContent(`
            <button>Open</button>
            <p role="status"></p>
            ${hydrateLater(`
              document.querySelector("button").addEventListener("click", () => {
                document.querySelector("[role=status]").textContent = "Opened"
              })
            `)}
          `)
          await expect(page.getByRole("button", { name: "Open" })).toBeVisible()
        })

        await test.step("Playwright counts a click on it as a success, even though nothing happened.\n", async () => {
          await page.getByRole("button", { name: "Open" }).click()
          await page.waitForTimeout(HYDRATION_DELAY_MS * 1.5)
          await expect(page.getByRole("status")).toHaveText("")
        })

        await test.step("Waiting for `networkidle` doesn't fix it.\n", async () => {
          await injectMarkdown(
            testInfo,
            [
              "It hides the problem most of the time but still flakes, because an idle network says nothing about whether hydration has finished.",
              "",
              "If the page long-polls, `networkidle` never arrives at all: the poll request stays open, so the wait runs until it times out.",
            ].join("\n"),
          )
          // A route that never responds stands in for a long-poll request.
          await page.route("https://example.test/poll", () => {})
          await expect(
            page.setContent(
              `<script>fetch("https://example.test/poll")</script>`,
              {
                waitUntil: "networkidle",
                timeout: 2_000,
              },
            ),
          ).rejects.toThrow("Timeout")
          await injectMarkdown(
            testInfo,
            [
              "Retrying until the result appears is the only check that tells you the handler is attached. The helpers below do that retrying for you.",
              "",
              "Each helper waits for an assertion on what the interaction changed, such as a dialog opening or a status message updating. That's also good accessibility practice: every action should give the user feedback they can perceive, so they know it worked. If a click changes nothing a user can see or a screen reader can announce (see [WCAG 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)), the user can't tell it worked, and neither can your test. Assert on that feedback, ideally with `getByRole`, and the test also checks that the feedback is there.",
            ].join("\n"),
          )
        })
      })
    })

    test.describe("clickUntil", () => {
      test("Retry a click until the result appears", async ({
        page,
      }, testInfo) => {
        await test.step("Render a button whose click handler is attached late.\n", async () => {
          await page.setContent(`
            <button>Add shift</button>
            ${hydrateLater(`
              document.querySelector("button").addEventListener("click", () => {
                const dialog = document.createElement("dialog")
                dialog.setAttribute("aria-label", "New shift")
                document.body.append(dialog)
                dialog.show()
              })
            `)}
          `)
        })

        await test.step("Pass `clickUntil` the button to click and the element the click should reveal.\n", async () => {
          await injectCode(
            testInfo,
            `
import { clickUntil } from "@test2doc/playwright-utils"

await clickUntil(
  page.getByRole("button", { name: "Add shift" }),
  page.getByRole("dialog", { name: "New shift" }),
)
`,
          )
          await clickUntil(
            page.getByRole("button", { name: "Add shift" }),
            page.getByRole("dialog", { name: "New shift" }),
            { settle: 200 },
          )
          await expect(
            page.getByRole("dialog", { name: "New shift" }),
          ).toBeVisible()
        })

        await test.step("Clicks that are swallowed before hydration are retried, and retrying stops as soon as the dialog shows up.\n", async () => {
          await expect(page.getByRole("dialog")).toHaveCount(1)
          await injectMarkdown(
            testInfo,
            "A click that worked never gets a second one, which matters for toggles: this button opened exactly one dialog.",
          )
        })
      })

      test("Options", async ({ page }, testInfo) => {
        await test.step("`clickUntil` takes an optional third argument.\n", async () => {
          await injectMarkdown(
            testInfo,
            [
              "- `timeout` (default `15000`): the total time allowed before the click counts as a real failure.",
              "- `settle` (default `2000`): how long each click gets to make the expected element appear before it counts as swallowed and is retried. Raise it for actions that are slow but must not happen twice, such as a form submit.",
            ].join("\n"),
          )
        })

        await test.step("When the timeout runs out, `clickUntil` throws.\n", async () => {
          await page.setContent(`<button>Dead</button><p role="status"></p>`)
          await injectCode(
            testInfo,
            `
await clickUntil(
  page.getByRole("button", { name: "Dead" }),
  page.getByRole("status").getByText("Never"),
  { timeout: 500, settle: 100 },
) // throws
`,
          )
          await expect(
            clickUntil(
              page.getByRole("button", { name: "Dead" }),
              page.getByRole("status").getByText("Never"),
              { timeout: 500, settle: 100 },
            ),
          ).rejects.toThrow()
        })

        await test.step("Before each click, `clickUntil` hovers with `force: true`.\n", async () => {
          await injectMarkdown(
            testInfo,
            'A plain `hover()` waits for the element to stop moving, so buttons with a CSS hover transform (`translateY` on `:hover`) would send Playwright into an "element is not stable" retry loop.',
          )
        })
      })
    })

    test.describe("interactUntil", () => {
      test("Repeat any interaction until an assertion holds", async ({
        page,
      }, testInfo) => {
        await test.step("`interactUntil` is the general form of `clickUntil`, for interactions other than a single click.\n", async () => {
          await page.setContent(`
            <label>Start time <input /></label>
            <output></output>
            ${hydrateLater(trackValue("input"))}
          `)
        })

        await test.step("Pass it a function that interacts with the page and a function that asserts on the result. It runs both until the assertion passes or the timeout (default `15000`) runs out.\n", async () => {
          await injectCode(
            testInfo,
            `
import { fillWithChange, interactUntil } from "@test2doc/playwright-utils"

await interactUntil(
  () => fillWithChange(page.getByLabel("Start time"), "09:00"),
  () => expect(page.getByRole("status")).toHaveText("09:00"),
)
`,
          )
          await interactUntil(
            () => fillWithChange(page.getByLabel("Start time"), "09:00"),
            () =>
              expect(page.getByRole("status")).toHaveText("09:00", {
                timeout: 200,
              }),
          )
          await expect(page.getByRole("status")).toHaveText("09:00")
        })

        await test.step("The interaction may run several times, so it must be safe to repeat.\n", async () => {
          await expect(page.getByLabel("Start time")).toHaveValue("09:00")
        })
      })
    })

    test.describe("fillWithChange", () => {
      test("Force onChange for a value filled before hydration", async ({
        page,
      }, testInfo) => {
        await test.step("React remembers the last value it saw in each input and skips `onChange` when an `input` event reports no change.\n", async () => {
          await page.setContent(`
            <label>Name <input /></label>
            <output></output>
            ${hydrateLater(trackValue("input"))}
          `)
        })

        await test.step("If a fill before hydration already set the field to the value, filling the same value again never triggers `onChange`.\n", async () => {
          const input = page.getByRole("textbox", { name: "Name" })
          await input.fill("Ada")
          await page.waitForTimeout(HYDRATION_DELAY_MS * 1.5)
          await input.fill("Ada")
          await expect(page.getByRole("status")).toHaveText("")
        })

        await test.step("`fillWithChange` clears the field first, which forces a real change on every attempt. Use it instead of a bare `fill()` inside `interactUntil`.\n", async () => {
          await injectCode(
            testInfo,
            `
import { fillWithChange, interactUntil } from "@test2doc/playwright-utils"

await interactUntil(
  () => fillWithChange(page.getByRole("textbox", { name: "Name" }), "Ada"),
  () => expect(page.getByRole("status")).toHaveText("Ada"),
)
`,
          )
          await interactUntil(
            () =>
              fillWithChange(
                page.getByRole("textbox", { name: "Name" }),
                "Ada",
              ),
            () =>
              expect(page.getByRole("status")).toHaveText("Ada", {
                timeout: 200,
              }),
          )
          await expect(page.getByRole("status")).toHaveText("Ada")
        })
      })
    })

    test.describe("selectWithChange", () => {
      test("Force onChange for an option chosen before hydration", async ({
        page,
      }, testInfo) => {
        await test.step("`selectWithChange` is the `select` version of `fillWithChange`.\n", async () => {
          await page.setContent(`
            <label>Location
              <select>
                <option value="">Choose one</option>
                <option value="hq">Headquarters</option>
                <option value="annex">Annex</option>
              </select>
            </label>
            <output></output>
            ${hydrateLater(trackValue("select"))}
          `)
        })

        await test.step("Uncontrolled selects (an `onChange` but no `value`) have one more trap: if an option was chosen before hydration, the page keeps showing it while React's state never updates, and nothing on screen tells you.\n", async () => {
          const select = page.getByRole("combobox", { name: "Location" })
          await select.selectOption({ label: "Annex" })
          await page.waitForTimeout(HYDRATION_DELAY_MS * 1.5)
          await expect(select).toHaveValue("annex")
          await expect(page.getByRole("status")).toHaveText("")
        })

        await test.step("Choosing the same option again does nothing, so `selectWithChange` switches to the first option before choosing the one you asked for. It takes either `{ label }` or `{ value }`.\n", async () => {
          await injectCode(
            testInfo,
            `
import { interactUntil, selectWithChange } from "@test2doc/playwright-utils"

await interactUntil(
  () =>
    selectWithChange(page.getByRole("combobox", { name: "Location" }), {
      label: "Annex",
    }),
  () => expect(page.getByRole("status")).toHaveText("annex"),
)
`,
          )
          await interactUntil(
            () =>
              selectWithChange(
                page.getByRole("combobox", { name: "Location" }),
                { label: "Annex" },
              ),
            () =>
              expect(page.getByRole("status")).toHaveText("annex", {
                timeout: 200,
              }),
          )
          await expect(page.getByRole("status")).toHaveText("annex")
        })
      })
    })
  },
)
