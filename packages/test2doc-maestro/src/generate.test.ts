import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { generateDocs } from "./generate.js"
import { isBlue, readPng, solidPng } from "./testUtils/images.js"
import {
  entry,
  instruction,
  resetSequence,
  screenshot,
  section,
} from "./testUtils/commands.js"

const PNG = Buffer.from("fake-png-bytes")

const writeFlow = (
  inputDir: string,
  name: string,
  entries: unknown[],
  shots: string[] = [],
  bytes: Buffer = PNG,
  log?: string,
) => {
  const flowDir = join(inputDir, "2026-09-30_100000", name)
  mkdirSync(join(flowDir, "takeScreenshot"), { recursive: true })
  writeFileSync(join(flowDir, "commands.json"), JSON.stringify(entries))
  for (const shot of shots) {
    writeFileSync(join(flowDir, "takeScreenshot", `${shot}.png`), bytes)
  }
  if (log !== undefined) {
    mkdirSync(join(flowDir, "logs"), { recursive: true })
    writeFileSync(join(flowDir, "logs", "maestro.log"), log)
  }
}

const grayPng = (width: number, height: number) => solidPng(width, height)

const tapLine = (attrs: string) =>
  `10:00:00.000 [ INFO] maestro.Maestro.tap-X: Tapping on element:  UiElement(treeNode=TreeNode(attributes={${attrs}}, children=[], clickable=true), bounds=Bounds(x=0, y=0, width=1, height=1))`
const FIELD_LOG = tapLine(
  "text=, hintText=What needs doing?, resource-id=todo-input, bounds=[42,310][888,409], enabled=true",
)
const IOS_LOG = tapLine(
  "accessibilityText=, title=, value=, text=, hintText=What needs doing?, resource-id=todo-input, bounds=[17,124][327,157], enabled=true",
)

const tapField = () => {
  const tap = instruction("Tap the text field")
  tap.command.tapOnElement = {
    label: "Tap the text field",
    selector: { idRegex: "todo-input" },
  }
  return tap
}
const fieldFlow = () => [section("Add"), screenshot("before"), tapField()]

describe("generateDocs", () => {
  let inputDir: string
  let outputDir: string

  beforeEach(() => {
    resetSequence()
    inputDir = mkdtempSync(join(tmpdir(), "t2d-maestro-in-"))
    outputDir = mkdtempSync(join(tmpdir(), "t2d-maestro-out-"))
  })

  it("writes one mdx page per flow, named after the flow", () => {
    writeFlow(inputDir, "Todo CRUD", [section("Create todo items")])

    generateDocs({ inputs: [{ dir: inputDir }], outputDir })

    expect(readdirSync(outputDir)).toEqual(["test2doc-todo-crud.mdx"])
    expect(
      readFileSync(join(outputDir, "test2doc-todo-crud.mdx"), "utf8"),
    ).toBe("# Todo CRUD\n\n## Create todo items\n\n")
  })

  it("copies screenshots next to the page under a content-hashed name", () => {
    writeFlow(
      inputDir,
      "Todo CRUD",
      [section("Create todo items"), screenshot("created")],
      ["created"],
    )

    generateDocs({ inputs: [{ dir: inputDir }], outputDir })

    const png = readdirSync(outputDir).find((f) => f.endsWith(".png"))
    expect(png).toMatch(/^test2doc-[0-9a-f]{12}\.png$/)
    expect(readFileSync(join(outputDir, png ?? ""))).toEqual(PNG)
    expect(
      readFileSync(join(outputDir, "test2doc-todo-crud.mdx"), "utf8"),
    ).toContain(`![Create todo items](./${png})`)
  })

  it("removes old test2doc files but leaves everything else", () => {
    writeFileSync(join(outputDir, "test2doc-stale.mdx"), "old")
    writeFileSync(join(outputDir, "intro.md"), "keep me")
    writeFlow(inputDir, "Todo CRUD", [section("Step")])

    generateDocs({ inputs: [{ dir: inputDir }], outputDir })

    expect(readdirSync(outputDir).sort()).toEqual([
      "intro.md",
      "test2doc-todo-crud.mdx",
    ])
  })

  it("creates the output directory when it does not exist", () => {
    const nested = join(outputDir, "docs", "mobile")
    writeFlow(inputDir, "Todo CRUD", [section("Step")])

    generateDocs({ inputs: [{ dir: inputDir }], outputDir: nested })

    expect(readdirSync(nested)).toEqual(["test2doc-todo-crud.mdx"])
  })

  it("fails when a flow contains a failed command", () => {
    writeFlow(inputDir, "Todo CRUD", [
      entry("tapOnElement", { status: "FAILED" }),
    ])

    expect(() =>
      generateDocs({ inputs: [{ dir: inputDir }], outputDir }),
    ).toThrow(/Todo CRUD/)
  })

  it("fails when the input directory has no flow output", () => {
    expect(() =>
      generateDocs({ inputs: [{ dir: inputDir }], outputDir }),
    ).toThrow(/commands\.json/)
  })

  it("returns how many pages and screenshots it wrote", () => {
    writeFlow(inputDir, "Todo CRUD", [section("Step"), screenshot("a")], ["a"])

    expect(generateDocs({ inputs: [{ dir: inputDir }], outputDir })).toEqual({
      pages: 1,
      screenshots: 1,
      warnings: [],
    })
  })

  describe("with one input per platform", () => {
    const setup = () => {
      const androidDir = mkdtempSync(join(tmpdir(), "t2d-android-"))
      const webDir = mkdtempSync(join(tmpdir(), "t2d-web-"))
      const steps = () => [section("Create todo items"), screenshot("created")]
      writeFlow(
        androidDir,
        "Todo CRUD",
        steps(),
        ["created"],
        Buffer.from("android-png"),
      )
      resetSequence()
      writeFlow(
        webDir,
        "Todo CRUD",
        steps(),
        ["created"],
        Buffer.from("web-png"),
      )
      return { androidDir, webDir }
    }

    it("writes one page per flow, with a tab for each platform's screenshot", () => {
      const { androidDir, webDir } = setup()

      const result = generateDocs({
        inputs: [
          { platform: "android", dir: androidDir },
          { platform: "web", dir: webDir },
        ],
        outputDir,
      })

      const page = readFileSync(
        join(outputDir, "test2doc-todo-crud.mdx"),
        "utf8",
      )
      expect(
        readdirSync(outputDir).filter((f) => f.endsWith(".mdx")),
      ).toHaveLength(1)
      expect(page).toContain('<TabItem value="android" label="Android">')
      expect(page).toContain('<TabItem value="web" label="Web">')
      expect(result).toEqual({ pages: 1, screenshots: 2, warnings: [] })
    })

    it("fails when the platforms' flows differ", () => {
      const { androidDir, webDir } = setup()
      writeFlow(webDir, "Todo CRUD", [section("A different step")])

      expect(() =>
        generateDocs({
          inputs: [
            { platform: "android", dir: androidDir },
            { platform: "web", dir: webDir },
          ],
          outputDir,
        }),
      ).toThrow(/Todo CRUD/)
    })

    it("fails when several inputs are not all labeled with a platform", () => {
      const { androidDir, webDir } = setup()

      expect(() =>
        generateDocs({
          inputs: [{ platform: "android", dir: androidDir }, { dir: webDir }],
          outputDir,
        }),
      ).toThrow(/platform/)
    })

    it("fails when two inputs share a platform", () => {
      const { androidDir, webDir } = setup()

      expect(() =>
        generateDocs({
          inputs: [
            { platform: "web", dir: androidDir },
            { platform: "web", dir: webDir },
          ],
          outputDir,
        }),
      ).toThrow(/web/)
    })

    it("keeps a flow that only one platform ran as a single-platform page", () => {
      const androidDir = mkdtempSync(join(tmpdir(), "t2d-android-"))
      const webDir = mkdtempSync(join(tmpdir(), "t2d-web-"))
      writeFlow(androidDir, "Android only", [section("Step")])
      writeFlow(webDir, "Web only", [section("Step")])

      generateDocs({
        inputs: [
          { platform: "android", dir: androidDir },
          { platform: "web", dir: webDir },
        ],
        outputDir,
      })

      expect(readdirSync(outputDir).sort()).toEqual([
        "test2doc-android-only.mdx",
        "test2doc-web-only.mdx",
      ])
    })
  })

  describe("highlights", () => {
    const outputPng = () =>
      readPng(
        readFileSync(
          join(
            outputDir,
            readdirSync(outputDir).find((f) => f.endsWith(".png")) ?? "",
          ),
        ),
      )
    const marked = () => outputPng().changed().length > 0

    it("marks the tapped element on the screenshot before the tap", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
        FIELD_LOG,
      )

      generateDocs({ inputs: [{ dir: inputDir }], outputDir })

      const out = outputPng()
      expect([out.width, out.height]).toEqual([1080, 2400])
      expect(marked()).toBe(true)
    })

    it("annotates with the step's words", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
        FIELD_LOG,
      )

      generateDocs({ inputs: [{ dir: inputDir }], outputDir })

      // the label sits away from the element, at x 42..888 and y 310..409
      const outside = outputPng()
        .changed()
        .filter(([, y]) => y < 290 || y > 430)
      expect(outside.length).toBeGreaterThan(50)
    })

    it("leaves the screenshot alone when there is no log", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
      )

      generateDocs({ inputs: [{ dir: inputDir }], outputDir })

      expect(marked()).toBe(false)
    })

    it("leaves the screenshot alone when the log does not show the tap", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
        "nothing here",
      )

      generateDocs({ inputs: [{ dir: inputDir }], outputDir })

      expect(marked()).toBe(false)
    })

    it("works out the scale of an iOS screenshot from its width", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1206, 2622),
        IOS_LOG,
      )

      const result = generateDocs({
        inputs: [{ platform: "ios", dir: inputDir }],
        outputDir,
      })

      expect(result.warnings).toEqual([])
      expect(marked()).toBe(true)
    })

    it("warns and skips the highlight when it cannot tell the iOS scale", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1234, 2622),
        IOS_LOG,
      )

      const result = generateDocs({
        inputs: [{ platform: "ios", dir: inputDir }],
        outputDir,
      })

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toMatch(/Todo CRUD.*ios@/)
      expect(marked()).toBe(false)
    })

    it("uses a scale given for the input", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1234, 2622),
        IOS_LOG,
      )

      const result = generateDocs({
        inputs: [{ platform: "ios", scale: 3, dir: inputDir }],
        outputDir,
      })

      expect(result.warnings).toEqual([])
      expect(marked()).toBe(true)
    })

    it("styles highlights with the annotation defaults it is given", () => {
      writeFlow(
        inputDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
        FIELD_LOG,
      )

      generateDocs({
        inputs: [{ dir: inputDir }],
        outputDir,
        annotationDefaults: { highlightStrokeStyle: "rgb(0, 0, 255)" },
      })

      // the top edge of the element at y 310
      expect(isBlue(outputPng().pixel(400, 309))).toBe(true)
    })

    it("still merges platforms whose elements sit in different places", () => {
      const androidDir = mkdtempSync(join(tmpdir(), "t2d-android-"))
      const webDir = mkdtempSync(join(tmpdir(), "t2d-web-"))
      writeFlow(
        androidDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(1080, 2400),
        FIELD_LOG,
      )
      resetSequence()
      writeFlow(
        webDir,
        "Todo CRUD",
        fieldFlow(),
        ["before"],
        grayPng(500, 1100),
        tapLine(
          "text=What needs doing?, bounds=[16,61][426,96], resource-id=todo-input",
        ),
      )

      const result = generateDocs({
        inputs: [
          { platform: "android", dir: androidDir },
          { platform: "web", dir: webDir },
        ],
        outputDir,
      })

      expect(result.pages).toBe(1)
      expect(result.screenshots).toBe(2)
    })
  })
})
