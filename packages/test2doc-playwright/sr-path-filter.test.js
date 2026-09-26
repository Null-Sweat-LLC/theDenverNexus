import { describe, expect, test, vi } from "vitest"

vi.mock("node:child_process", () => ({
  // Hashes of commits that touched this package directory
  execSync: vi.fn(() => Buffer.from("aaa\nbbb\nccc\n")),
}))

const { filterCommits } = await import("./sr-path-filter.js")

describe("filterCommits", () => {
  test("keeps only commits that touched this package", () => {
    const commits = [
      { hash: "aaa", message: "feat(test2doc-playwright): new feature" },
      { hash: "zzz", message: "feat(test2doc-docs): docs page" },
    ]

    expect(filterCommits({ cwd: ".", commits })).toEqual([commits[0]])
  })

  test.each(["ci", "cd", "ci/cd", "deps", "release", "CI/CD"])(
    "drops commits with the %s scope even if they touched this package",
    (scope) => {
      const commits = [{ hash: "bbb", message: `fix(${scope}): something` }]

      expect(filterCommits({ cwd: ".", commits })).toEqual([])
    },
  )

  test("keeps commits without a scope", () => {
    const commits = [{ hash: "ccc", message: "fix: something" }]

    expect(filterCommits({ cwd: ".", commits })).toEqual(commits)
  })
})
