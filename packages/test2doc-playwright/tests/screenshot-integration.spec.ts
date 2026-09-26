import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { screenshot } from "../src/screenshots.js"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import "../src/types.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const setup = async (page: Page) => {
  return page.setContent(`
      <html>
        <body style="margin: 0; padding: 20px; background: white;">
          <button id="test-button" style="margin: auto; margin-top: 25%; background: blue; color: white; display: block;">
            Click Me
          </button>

          <button id="another-button" style="margin-top: 110vh; padding: 10px 20px; background: green; color: white; display: block;">
            Below the fold Button
          </button>
        </body>
      </html>
    `)
}

const setupWithRegions = async (page: Page) => {
  await page.setContent(`
    <html>
      <body style="margin: 0; padding: 0; background: white; height: 100vh; box-sizing: border-box; position: relative;">
        <button id="top-left-button" style="position: absolute; top: 0; left: 0; background: blue; color: white; display: block;">
          Top Left Button
        </button>

        <button id="top-right-button" style="position: absolute; top: 0; right: 0; background: blue; color: white; display: block;">
          Top Right Button
        </button>

        <section aria-label="left side" style="position: relative; height: 100%; width: 50%; border: 2px solid black; box-sizing: border-box; float: left; text-align: center;">
          left side
        </section>

        <button id="middle-button" style="position: absolute; top: 50%; left: 50%; transform: translateX(-50%); background: orange; color: white; display: block;">
          Middle Button
        </button>

        <section aria-label="right side" style="position: relative; height: 100%; width: 50%; border: 2px solid black; box-sizing: border-box; float: right; text-align: center;">
          right side
        </section>

        <button id="bottom-left-button" style="position: absolute; bottom: 0; left: 0; background: green; color: white; display: block;">
          Bottom Left Button
        </button>

        <button id="bottom-right-button" style="position: absolute; bottom: 0; right: 0; background: green; color: white; display: block;">
          Bottom Right Button
        </button>
      </body>
    </html>
  `)
}

const expectScreenshotToMatch = async (
  testInfo: TestInfo,
  screenshotFileName: string,
) => {
  const hasDefaultAnnotations =
    !!testInfo.project?.use?.test2doc?.annotationDefaults
  const screenshotAttachment = testInfo.attachments.pop()

  const expectedPath = join(
    __dirname,
    "expected-screenshots",
    hasDefaultAnnotations
      ? `annotated-${screenshotFileName}`
      : screenshotFileName,
  )

  if (existsSync(expectedPath)) {
    const expectedBuffer = PNG.sync.read(readFileSync(expectedPath))
    const { width, height } = expectedBuffer
    const diff = new PNG({ width, height })
    const matchedPixels = pixelmatch(
      PNG.sync.read(screenshotAttachment?.body ?? Buffer.from("")).data,
      expectedBuffer.data,
      diff.data,
      width,
      height,
      { threshold: 1 },
    )
    if (matchedPixels > 0) {
      writeFileSync(
        expectedPath.replace(".png", "-diff.png"),
        PNG.sync.write(diff),
      )
    }
    expect(matchedPixels).toBe(0)
  } else {
    writeFileSync(expectedPath, screenshotAttachment?.body ?? Buffer.from(""))
    console.warn(
      `Expected screenshot did not exist. Created at ${expectedPath}. Please verify it is correct.`,
    )
  }
}

test("screenshot of a page", async ({ page }, testInfo) => {
  await setup(page)

  await screenshot(testInfo, page)

  await expectScreenshotToMatch(testInfo, "screenshot-page.png")
})

test("screenshot highlighting an element", async ({ page }, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button)

  await expectScreenshotToMatch(testInfo, "highlight-element.png")
})

test("screenshot of element off the screen should be scrolled into view", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Below the fold Button" })
  await screenshot(testInfo, button)

  await expectScreenshotToMatch(testInfo, "element-off-screen.png")
})

test("screenshot highlighting an element with label text", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button, { annotation: { text: "Test Button" } })

  await expectScreenshotToMatch(testInfo, "highlighting-element-label.png")
})

test("screenshot style the rendering of the highlight and label", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button, {
    annotation: {
      text: "This is the test button",
      fillStyle: "white",
      font: "14px 'Times New Roman', Times, serif",
      strokeStyle: "#000000AA",
      lineWidth: 4,
      labelBoxFillStyle: "hsla(170, 45%, 45%, 0.5)",
      labelBoxStrokeStyle: "#0f0",
      labelBoxLineWidth: 2,
      highlightFillStyle: "rgba(255, 165, 0, 0.3)",
      highlightStrokeStyle: "#FFA500",
      highlightLineWidth: 2,
    },
  })

  await expectScreenshotToMatch(testInfo, "style-highlight-label.png")
})

test("screenshot label positioning", async ({ page }, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", position: "above" },
  })

  await expectScreenshotToMatch(testInfo, "label-position-above.png")

  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", position: "below" },
  })

  await expectScreenshotToMatch(testInfo, "label-position-below.png")

  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", position: "left" },
  })

  await expectScreenshotToMatch(testInfo, "label-position-left.png")

  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", position: "right" },
  })

  await expectScreenshotToMatch(testInfo, "label-position-right.png")
})

test("positioning label intelligently when no position is specified", async ({
  page,
}, testInfo) => {
  await setupWithRegions(page)

  const leftRegion = page.getByRole("region", { name: "left side" })
  await screenshot(testInfo, leftRegion, {
    annotation: { text: "Label on the right side" },
  })
  await expectScreenshotToMatch(testInfo, "auto-position-right.png")

  const topRightButton = page.getByRole("region", { name: "right side" })
  await screenshot(testInfo, topRightButton, {
    annotation: { text: "Label on the left side" },
  })
  await expectScreenshotToMatch(testInfo, "auto-position-left.png")

  const middleButton = page.getByRole("button", { name: "Middle Button" })
  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label on the bottom side" },
  })
  await expectScreenshotToMatch(testInfo, "auto-position-bottom.png")

  const bottomLeftButton = page.getByRole("button", {
    name: "Bottom Left Button",
  })
  await screenshot(testInfo, bottomLeftButton, {
    annotation: { text: "Label on the top side" },
  })
  await expectScreenshotToMatch(testInfo, "auto-position-top.png")
})

test("screenshot with arrow pointing to the element", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", position: "above", showArrow: true },
  })

  await expectScreenshotToMatch(testInfo, "arrow-position-above.png")

  await screenshot(testInfo, button, {
    annotation: {
      text: "Test Button",
      fillStyle: "white",
      position: "below",
      showArrow: true,
      arrowLineWidth: 1,
      arrowStrokeStyle: "purple",
      labelBoxFillStyle: "purple",
    },
  })

  await expectScreenshotToMatch(testInfo, "arrow-position-below.png")

  await screenshot(testInfo, button, {
    annotation: {
      text: "Test Button",
      position: "left",
      showArrow: true,
      arrowStrokeStyle: "rgba(255, 0, 0, 0.5)",
      labelBoxStrokeStyle: "rgba(255, 0, 0, 0.5)",
      labelBoxLineWidth: 3,
    },
  })

  await expectScreenshotToMatch(testInfo, "arrow-position-left.png")

  await screenshot(testInfo, button, {
    annotation: {
      text: "Test Button",
      position: "right",
      showArrow: true,
      arrowLineWidth: 4,
    },
  })

  await expectScreenshotToMatch(testInfo, "arrow-position-right.png")
})

test("screenshot with arrow on left/right should have vertically centered text", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })

  // Left position with multi-character text to verify vertical centering
  await screenshot(testInfo, button, {
    annotation: {
      text: "Login Button",
      position: "left",
      showArrow: true,
      labelBoxFillStyle: "rgba(255, 255, 0, 0.8)",
      labelBoxStrokeStyle: "rgba(0, 0, 0, 1)",
      labelBoxLineWidth: 2,
    },
  })

  await expectScreenshotToMatch(testInfo, "arrow-text-align-left.png")

  // Right position with multi-character text to verify vertical centering
  await screenshot(testInfo, button, {
    annotation: {
      text: "Submit Button",
      position: "right",
      showArrow: true,
      labelBoxFillStyle: "rgba(0, 255, 255, 0.8)",
      labelBoxStrokeStyle: "rgba(0, 0, 0, 1)",
      labelBoxLineWidth: 2,
    },
  })

  await expectScreenshotToMatch(testInfo, "arrow-text-align-right.png")
})

test("screenshot multiple targets", async ({ page }, testInfo) => {
  await setupWithRegions(page)

  const topLeftButton = page.getByRole("button", { name: "Top Left Button" })
  const topRightButton = page.getByRole("button", { name: "Top Right Button" })
  const middleButton = page.getByRole("button", { name: "Middle Button" })
  const bottomLeftButton = page.getByRole("button", {
    name: "Bottom Left Button",
  })
  const bottomRightButton = page.getByRole("button", {
    name: "Bottom Right Button",
  })

  await screenshot(
    testInfo,
    [
      { target: topLeftButton },
      {
        target: topRightButton,
        options: { annotation: { text: "Top Right", position: "left" } },
      },
      {
        target: middleButton,
        options: {
          annotation: {
            text: "Middle",
            showArrow: true,
            arrowStrokeStyle: "red",
            highlightFillStyle: "rgba(255, 0, 0, 0.3)",
            highlightStrokeStyle: "rgba(255, 0, 0, 1)",
            highlightLineWidth: 2,
          },
        },
      },
      {
        target: bottomLeftButton,
        options: {
          annotation: {
            text: "Bottom Left",
            font: "12px Arial, sans-serif",
            labelBoxFillStyle: "yellow",
          },
        },
      },
      {
        target: bottomRightButton,
        options: {
          annotation: {
            text: "Bottom Right",
            font: "bold 12px Arial, sans-serif",
          },
        },
      },
    ],
    { annotation: { font: "14px 'Times New Roman', Times, serif" } },
  )

  await expectScreenshotToMatch(testInfo, "multiple-targets.png")
})

test("positioning label based off of degrees", async ({ page }, testInfo) => {
  await setupWithRegions(page)

  const middleButton = page.getByRole("button", { name: "Middle Button" })
  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 0°", position: 0 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-0.png")

  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 45°", position: 45 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-45.png")

  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 90°", position: 90 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-90.png")

  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 120°", position: 120 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-120.png")

  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 258°", position: 258 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-258.png")

  await screenshot(testInfo, middleButton, {
    annotation: { text: "Label at 270°", position: 270 },
  })
  await expectScreenshotToMatch(testInfo, "label-position-270.png")
})

test("positioning arrow based off of degrees", async ({ page }, testInfo) => {
  await setupWithRegions(page)

  const middleButton = page.getByRole("button", { name: "Middle Button" })
  await screenshot(
    testInfo,
    [
      {
        target: middleButton,
        options: {
          annotation: {
            text: "Label at 10°",
            position: 10,
            labelBoxFillStyle: "rgba(255, 0, 0, 0.3)",
            labelBoxStrokeStyle: "rgba(255, 0, 0, 1)",
            labelBoxLineWidth: 2,
          },
        },
      },
      {
        target: middleButton,
        options: {
          annotation: { text: "Label at 120°", position: 120 },
        },
      },
      {
        target: middleButton,
        options: {
          annotation: { text: "Label at 80°", position: 80 },
        },
      },
      {
        target: middleButton,
        options: {
          annotation: { text: "Label at 300°", position: 300 },
        },
      },
      {
        target: middleButton,
        options: {
          annotation: {
            text: "Label at 260°",
            position: 260,
            labelBoxFillStyle: "rgba(0, 255, 255, 0.5)",
          },
        },
      },
    ],
    { annotation: { showArrow: true } },
  )
  await expectScreenshotToMatch(
    testInfo,
    "label-position-degrees-with-arrows.png",
  )
})

test("screenshot should take alt text from annotation when provided", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })
  await screenshot(testInfo, button, {
    annotation: { text: "Test Button", altText: "Custom alt text for testing" },
  })

  expect(testInfo.attachments[0].name).toMatch(
    /test2doc-\d+-\d.png:Custom alt text for testing/,
  )

  await screenshot(testInfo, button, {
    annotation: { text: "Yet another button", altText: "more better alt text" },
  })

  expect(testInfo.attachments[1].name).toMatch(
    /test2doc-\d+-\d.png:more better alt text/,
  )

  await screenshot(testInfo, button, {
    annotation: { text: "more button or something" },
  })

  expect(testInfo.attachments[2].name).toMatch(/test2doc-\d+-\d.png/)
})

test("screenshot highlighting element inside dialog - dialog should not render over annotation canvas", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <html>
      <body style="margin: 0; padding: 20px; background: white;">
        <button id="open-dialog" onclick="document.getElementById('test-dialog').showModal()">
          Open Dialog
        </button>
        <dialog id="test-dialog" style="padding: 20px; border-radius: 8px;">
          <h2 id="dialog-heading">Dialog Title</h2>
          <p>This is some dialog content.</p>
          <button onclick="document.getElementById('test-dialog').close()">Close</button>
        </dialog>
      </body>
    </html>
  `)

  await page.getByRole("button", { name: "Open Dialog" }).click()
  await page.waitForSelector("dialog[open]")

  const heading = page.locator("dialog h2")
  await screenshot(testInfo, heading, {
    annotation: { text: "Dialog Heading", showArrow: true, position: "below" },
  })

  await expectScreenshotToMatch(testInfo, "dialog-element-annotation.png")
})

test("screenshot should support figure and caption metadata for HTML figure elements", async ({
  page,
}, testInfo) => {
  await setup(page)

  const button = page.getByRole("button", { name: "Click Me" })

  // Screenshot with figure and caption
  await screenshot(testInfo, button, {
    annotation: {
      text: "Test Button",
      figure: true,
      caption: "User login button",
    },
  })

  expect(testInfo.attachments[0].name).toMatch(
    /test2doc-\d+-\d.png\[test2doc_screenshot\]:\{"figure":true,"caption":"User login button"\}/,
  )

  // Screenshot with figure but no custom caption
  await screenshot(testInfo, button, {
    annotation: {
      text: "Another button",
      figure: true,
    },
  })

  expect(testInfo.attachments[1].name).toMatch(
    /test2doc-\d+-\d.png\[test2doc_screenshot\]:\{"figure":true\}/,
  )

  // Screenshot with figure and caption but no annotation text
  await screenshot(testInfo, button, {
    annotation: {
      figure: true,
      caption: "Submit button",
    },
  })

  expect(testInfo.attachments[2].name).toMatch(
    /test2doc-\d+-\d.png\[test2doc_screenshot\]:\{"figure":true,"caption":"Submit button"\}/,
  )
})

test("label that would overflow the viewport falls back to a side that fits", async ({
  page,
}, testInfo) => {
  await setupWithRegions(page)

  const leftRegion = page.getByRole("region", { name: "left side" })
  await screenshot(testInfo, leftRegion, {
    annotation: {
      text: "Label that would be clipped on the left",
      position: "left",
      showArrow: true,
    },
  })
  await expectScreenshotToMatch(testInfo, "label-overflow-fallback.png")

  const topLeftButton = page.getByRole("button", { name: "Top Left Button" })
  await screenshot(testInfo, topLeftButton, {
    annotation: {
      text: "Label that would be clipped above",
      position: "above",
      showArrow: true,
    },
  })
  await expectScreenshotToMatch(testInfo, "label-overflow-corner.png")
})
