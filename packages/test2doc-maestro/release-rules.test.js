import { readFileSync } from "node:fs"
import { describe, expect, test, vi } from "vitest"

vi.mock("node:child_process", () => ({
  // Every commit below counts as having touched this package
  execSync: vi.fn(() => Buffer.from("a\nb\nc\nd\ne\nf\n")),
}))

const { analyzeCommits } = await import("./sr-path-filter.js")

const config = JSON.parse(
  readFileSync(new URL("./.releaserc.json", import.meta.url), "utf8"),
)
const analyzerConfig = config.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "./sr-path-filter.js",
)[1]

const releaseFor = (message) =>
  analyzeCommits(analyzerConfig, {
    cwd: ".",
    commits: [{ hash: "a", message }],
    logger: { log: () => {} },
  })

describe("release rules", () => {
  test("tags releases with the package's own prefix", () => {
    expect(config.tagFormat).toBe("test2doc-maestro-v${version}")
  })

  test.each([
    ["feat: add a flag", "minor"],
    ["fix: handle an empty log", "patch"],
    ["perf: decode screenshots faster", "patch"],
    ["revert: undo the last change", "patch"],
  ])("%s releases a %s", async (message, type) => {
    expect(await releaseFor(message)).toBe(type)
  })

  test.each([
    "docs: update the readme",
    "chore: bump a dev dependency",
    "ci: tweak the workflow",
  ])("%s releases nothing", async (message) => {
    expect(await releaseFor(message)).toBeNull()
  })

  // The package stays on 0.x while it is being tried out, so a breaking
  // change bumps the minor version rather than jumping to 1.0.0
  test.each([
    ["feat!: drop the old flag"],
    ["fix!: change the output names"],
    ["perf!: change the image format"],
    ["feat: add a flag\n\nBREAKING CHANGE: the flag replaces --input"],
    ["fix: handle an empty log\n\nBREAKING CHANGE: empty logs now fail"],
  ])("a breaking change stays below 1.0.0: %j", async (message) => {
    const type = await releaseFor(message)

    expect(type).not.toBe("major")
    expect(type).toBe("minor")
  })
})
