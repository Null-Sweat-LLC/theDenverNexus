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
import {
  entry,
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
) => {
  const flowDir = join(inputDir, "2026-09-30_100000", name)
  mkdirSync(join(flowDir, "takeScreenshot"), { recursive: true })
  writeFileSync(join(flowDir, "commands.json"), JSON.stringify(entries))
  for (const shot of shots) {
    writeFileSync(join(flowDir, "takeScreenshot", `${shot}.png`), PNG)
  }
}

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

    generateDocs({ inputDir, outputDir })

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

    generateDocs({ inputDir, outputDir })

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

    generateDocs({ inputDir, outputDir })

    expect(readdirSync(outputDir).sort()).toEqual([
      "intro.md",
      "test2doc-todo-crud.mdx",
    ])
  })

  it("creates the output directory when it does not exist", () => {
    const nested = join(outputDir, "docs", "mobile")
    writeFlow(inputDir, "Todo CRUD", [section("Step")])

    generateDocs({ inputDir, outputDir: nested })

    expect(readdirSync(nested)).toEqual(["test2doc-todo-crud.mdx"])
  })

  it("fails when a flow contains a failed command", () => {
    writeFlow(inputDir, "Todo CRUD", [
      entry("tapOnElement", { status: "FAILED" }),
    ])

    expect(() => generateDocs({ inputDir, outputDir })).toThrow(/Todo CRUD/)
  })

  it("fails when the input directory has no flow output", () => {
    expect(() => generateDocs({ inputDir, outputDir })).toThrow(
      /commands\.json/,
    )
  })

  it("returns how many pages and screenshots it wrote", () => {
    writeFlow(inputDir, "Todo CRUD", [section("Step"), screenshot("a")], ["a"])

    expect(generateDocs({ inputDir, outputDir })).toEqual({
      pages: 1,
      screenshots: 1,
    })
  })
})
