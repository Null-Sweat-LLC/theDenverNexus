import type { Block, Flow } from "./types.js"

/**
 * Renders a flow as a how-to guide in markdown: an h1 for the flow, an h2 per
 * section, numbered instructions with their screenshots nested under them,
 * and Docusaurus admonitions for callouts.
 * `outputNames` maps a screenshot's path in the run output to its file name.
 */
export const renderMarkdown = (
  name: string,
  flow: Flow,
  outputNames: Record<string, string>,
) => {
  const renderBlocks = (blocks: Block[], fallbackAlt: string) => {
    let markdown = ""
    let step = 0
    let previous: Block | undefined

    for (const block of blocks) {
      switch (block.type) {
        case "instruction":
          markdown += `${++step}. ${block.text}\n\n`
          break
        case "text":
          markdown += `${block.text}\n\n`
          break
        case "callout":
          markdown += `:::${block.kind}\n${block.text}\n:::\n\n`
          break
        case "screenshot": {
          const file = outputNames[block.path]
          if (!file)
            throw new Error(`No output file for screenshot ${block.path}`)
          const follows =
            previous?.type === "instruction" ? previous : undefined
          const indent = follows ? " ".repeat(`${step}. `.length) : ""
          markdown += `${indent}![${follows?.text ?? fallbackAlt}](./${file})\n\n`
          break
        }
      }
      previous = block
    }

    return markdown
  }

  let markdown = `# ${name}\n\n${renderBlocks(flow.blocks, name)}`

  for (const section of flow.sections) {
    markdown += `## ${section.title}\n\n${renderBlocks(section.blocks, section.title)}`
  }

  return markdown
}
