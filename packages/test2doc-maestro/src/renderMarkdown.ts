import type { Flow } from "./types.js"

const image = (path: string, outputNames: Record<string, string>) => {
  const name = outputNames[path]
  if (!name) throw new Error(`No output file for screenshot ${path}`)
  return `![screenshot](./${name})\n`
}

/**
 * Renders a flow as markdown in the same shape @test2doc/playwright writes:
 * an h1 for the page, then each step title followed by its screenshots.
 * `outputNames` maps a screenshot's path in the run output to its file name.
 */
export const renderMarkdown = (
  name: string,
  flow: Flow,
  outputNames: Record<string, string>,
) => {
  let markdown = `# ${name}\n\n`

  if (flow.screenshots.length > 0) {
    markdown += `${flow.screenshots.map((path) => image(path, outputNames)).join("")}\n`
  }

  for (const step of flow.steps) {
    markdown += `${step.title}\n`
    markdown += step.screenshots
      .map((path) => image(path, outputNames))
      .join("")
    markdown += "\n"
  }

  return markdown
}
