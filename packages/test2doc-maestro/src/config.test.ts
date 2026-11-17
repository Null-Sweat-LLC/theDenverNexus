import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadConfig } from "./config.js"

const write = (contents: string) => {
  const file = join(mkdtempSync(join(tmpdir(), "t2d-config-")), "config.json")
  writeFileSync(file, contents)
  return file
}

describe("loadConfig", () => {
  it("reads the annotation defaults", () => {
    const file = write(
      '{"annotationDefaults":{"showArrow":true,"position":"below"}}',
    )

    expect(loadConfig(file)).toEqual({
      annotationDefaults: { showArrow: true, position: "below" },
    })
  })

  it("has no defaults for an empty config", () => {
    expect(loadConfig(write("{}"))).toEqual({ annotationDefaults: {} })
  })

  it("reads maxDiffPixelRatio", () => {
    expect(loadConfig(write('{"maxDiffPixelRatio":0.01}'))).toEqual({
      annotationDefaults: {},
      maxDiffPixelRatio: 0.01,
    })
  })

  it.each(["0", "1"])("accepts a maxDiffPixelRatio of %s", (ratio) => {
    expect(
      loadConfig(write(`{"maxDiffPixelRatio":${ratio}}`)).maxDiffPixelRatio,
    ).toBe(Number(ratio))
  })

  it.each(['"0.1"', "-0.1", "1.5", "5", "null"])(
    "rejects a maxDiffPixelRatio of %s, naming the file",
    (ratio) => {
      const file = write(`{"maxDiffPixelRatio":${ratio}}`)

      expect(() => loadConfig(file)).toThrow(/maxDiffPixelRatio/)
      expect(() => loadConfig(file)).toThrow(/config\.json/)
    },
  )

  it("fails naming the file when it cannot be read", () => {
    expect(() => loadConfig("/not/here/config.json")).toThrow(
      /\/not\/here\/config\.json/,
    )
  })

  it("fails on invalid JSON", () => {
    expect(() => loadConfig(write("{nope"))).toThrow(/JSON/)
  })

  it("fails on an unknown top-level key", () => {
    expect(() => loadConfig(write('{"annotationDefault":{}}'))).toThrow(
      /annotationDefault/,
    )
  })

  it("fails on a bad annotation default, naming the file", () => {
    const file = write('{"annotationDefaults":{"lineWidth":"thick"}}')

    expect(() => loadConfig(file)).toThrow(/lineWidth/)
    expect(() => loadConfig(file)).toThrow(/config\.json/)
  })
})
