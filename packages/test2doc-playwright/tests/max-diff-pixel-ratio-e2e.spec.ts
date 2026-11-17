import { test, expect } from "@playwright/test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"

/**
 * Proves `maxDiffPixelRatio` end to end. Each "docs run" is a real
 * `playwright test` process with the test2doc reporter configured the way a
 * user would configure it, taking a real Chromium screenshot.
 *
 * The baseline run happens in the same test, on the same machine and browser,
 * so rendering differences between machines can't leak into the tolerance.
 */

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const FILENAME = "login.png"
const THRESHOLD = 0.01 // 1% of pixels

type Tweak = "none" | "small-badge-color" | "tall-line-spacing"

let workDir: string
let runCount = 0

// Runs the fixture suite with the reporter and returns the raw capture it took.
const docsRun = (
  tweak: Tweak,
  maxDiffPixelRatio: number | undefined,
): Buffer => {
  const capturePath = join(workDir, `capture-${++runCount}.png`)

  // Drop the variables of the Playwright process running this test, so the
  // child behaves like a fresh `playwright test` invocation.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("PW_") &&
        !key.startsWith("PLAYWRIGHT") &&
        key !== "TEST_WORKER_INDEX",
    ),
  )

  const result = spawnSync(
    "npx",
    ["playwright", "test", "--config", "e2e-fixture/playwright.config.ts"],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: {
        ...env,
        TEST2DOC_OUTPUT_DIR: join(workDir, "docs"),
        TEST2DOC_TWEAK: tweak,
        TEST2DOC_CAPTURE_PATH: capturePath,
        ...(maxDiffPixelRatio === undefined
          ? {}
          : { TEST2DOC_MAX_DIFF_PIXEL_RATIO: String(maxDiffPixelRatio) }),
      },
    },
  )

  if (result.status !== 0) {
    throw new Error(
      `Docs run failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    )
  }

  return readFileSync(capturePath)
}

const screenshotOnDisk = () => readFileSync(join(workDir, "docs", FILENAME))

const changedPixelRatio = (a: Buffer, b: Buffer) => {
  const pngA = PNG.sync.read(a)
  const pngB = PNG.sync.read(b)
  expect([pngB.width, pngB.height]).toEqual([pngA.width, pngA.height])
  const changed = pixelmatch(
    pngA.data,
    pngB.data,
    undefined,
    pngA.width,
    pngA.height,
  )
  return changed / (pngA.width * pngA.height)
}

test.describe("maxDiffPixelRatio (real test2doc run)", () => {
  // Several nested Playwright runs per test.
  test.setTimeout(120_000)

  test.beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "test2doc-e2e-"))
    runCount = 0
    // The reporter writes into an existing docs folder, like a real project's.
    mkdirSync(join(workDir, "docs"))
  })

  test.afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  test("keeps the screenshot on disk when only a few pixels changed", () => {
    const baseline = docsRun("none", THRESHOLD)
    expect(screenshotOnDisk().equals(baseline)).toBe(true)

    const tweaked = docsRun("small-badge-color", THRESHOLD)

    // Guard the premise: the page changed, but by no more than the threshold.
    const ratio = changedPixelRatio(baseline, tweaked)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThanOrEqual(THRESHOLD)

    expect(screenshotOnDisk().equals(baseline)).toBe(true)
  })

  test("replaces the screenshot when a lot of the page changed", () => {
    const baseline = docsRun("none", THRESHOLD)
    const reflowed = docsRun("tall-line-spacing", THRESHOLD)

    // Guard the premise: the line spacing change is well over the threshold.
    expect(changedPixelRatio(baseline, reflowed)).toBeGreaterThan(THRESHOLD)

    expect(screenshotOnDisk().equals(reflowed)).toBe(true)
  })

  test("replaces any changed screenshot when no threshold is set", () => {
    docsRun("none", undefined)
    const tweaked = docsRun("small-badge-color", undefined)

    expect(screenshotOnDisk().equals(tweaked)).toBe(true)
  })
})
