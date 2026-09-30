import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { run } from "./cli.js"
import { resetSequence, section } from "./testUtils/commands.js"

const capture = () => {
  const out: string[] = []
  const err: string[] = []
  return {
    io: {
      stdout: (s: string) => out.push(s),
      stderr: (s: string) => err.push(s),
    },
    out,
    err,
  }
}

describe("cli", () => {
  let inputDir: string
  let outputDir: string

  beforeEach(() => {
    resetSequence()
    inputDir = mkdtempSync(join(tmpdir(), "t2d-cli-in-"))
    outputDir = join(mkdtempSync(join(tmpdir(), "t2d-cli-out-")), "docs")
    const flowDir = join(inputDir, "run", "Todo CRUD")
    mkdirSync(flowDir, { recursive: true })
    writeFileSync(
      join(flowDir, "commands.json"),
      JSON.stringify([section("Step")]),
    )
  })

  it("generates docs from --input into --output and reports a summary", () => {
    const { io, out } = capture()

    const code = run(["--input", inputDir, "--output", outputDir], io)

    expect(code).toBe(0)
    expect(readdirSync(outputDir)).toEqual(["test2doc-todo-crud.mdx"])
    expect(out.join("")).toMatch(/1 page.*0 screenshots/)
  })

  it("accepts the short flags", () => {
    const { io } = capture()

    expect(run(["-i", inputDir, "-o", outputDir], io)).toBe(0)
  })

  it("exits 1 when the input directory does not exist", () => {
    const { io, err } = capture()

    const code = run(["--input", "/definitely/missing/dir"], io)

    expect(code).toBe(1)
    expect(err.join("")).toContain("/definitely/missing/dir")
  })

  it("exits 1 with usage when --input is missing", () => {
    const { io, err } = capture()

    expect(run([], io)).toBe(1)
    expect(err.join("")).toContain("--input")
  })

  it("prints usage and exits 0 for --help", () => {
    const { io, out } = capture()

    expect(run(["--help"], io)).toBe(0)
    expect(out.join("")).toContain("Usage: test2doc-maestro")
  })

  it("exits 1 and prints the reason when generation fails", () => {
    const { io, err } = capture()
    const empty = mkdtempSync(join(tmpdir(), "t2d-cli-empty-"))

    expect(run(["-i", empty, "-o", outputDir], io)).toBe(1)
    expect(err.join("")).toContain("commands.json")
  })

  it("exits 1 on an unknown option", () => {
    const { io, err } = capture()

    expect(run(["--nope"], io)).toBe(1)
    expect(err.join("")).toContain("--nope")
  })

  it("takes one labeled --input per platform and renders tabs", () => {
    const { io } = capture()
    const webDir = mkdtempSync(join(tmpdir(), "t2d-cli-web-"))
    const flowDir = join(webDir, "run", "Todo CRUD")
    mkdirSync(flowDir, { recursive: true })
    writeFileSync(
      join(flowDir, "commands.json"),
      JSON.stringify([section("Step")]),
    )

    const code = run(
      ["-i", `android=${inputDir}`, "-i", `web=${webDir}`, "-o", outputDir],
      io,
    )

    expect(code).toBe(0)
    expect(readdirSync(outputDir)).toEqual(["test2doc-todo-crud.mdx"])
  })

  it("exits 1 when several inputs are given without platforms", () => {
    const { io, err } = capture()

    expect(run(["-i", inputDir, "-i", inputDir, "-o", outputDir], io)).toBe(1)
    expect(err.join("")).toMatch(/platform/)
  })
})
