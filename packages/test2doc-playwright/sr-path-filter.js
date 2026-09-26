import { execSync } from "node:child_process"
import { analyzeCommits as analyzeAllCommits } from "@semantic-release/commit-analyzer"
import { generateNotes as generateAllNotes } from "@semantic-release/release-notes-generator"

const EXCLUDED_SCOPES = ["ci", "cd", "ci/cd", "deps", "release"]

/**
 * Keeps only commits that touched this package directory and are not
 * CI/CD or infrastructure commits.
 */
export const filterCommits = ({ cwd, commits }) => {
  const pathHashes = new Set(
    execSync("git log --format=%H -- .", { cwd })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean),
  )
  return commits.filter((c) => {
    if (!pathHashes.has(c.hash)) return false
    const scope = c.message?.match(/^\w+\(([^)]+)\):/)?.[1]?.toLowerCase()
    if (scope && EXCLUDED_SCOPES.includes(scope)) return false
    return true
  })
}

/**
 * Wraps commit-analyzer and release-notes-generator so they only see this
 * package's commits. semantic-release gives every plugin its own copy of the
 * context, so a separate plugin can't filter commits for the others; the
 * filtered commits have to be passed in directly.
 */
export const analyzeCommits = (pluginConfig, context) =>
  analyzeAllCommits(pluginConfig, {
    ...context,
    commits: filterCommits(context),
  })

export const generateNotes = (pluginConfig, context) =>
  generateAllNotes(pluginConfig, {
    ...context,
    commits: filterCommits(context),
  })
