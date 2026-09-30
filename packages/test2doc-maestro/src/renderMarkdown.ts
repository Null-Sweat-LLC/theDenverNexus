import type { Guide, GuideBlock, Image } from "./types.js"

const PLATFORM_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
}

const platformLabel = (platform: string) =>
  PLATFORM_LABELS[platform.toLowerCase()] ??
  platform.charAt(0).toUpperCase() + platform.slice(1)

const hasTabs = (blocks: GuideBlock[]) =>
  blocks.some((block) => block.type === "screenshot" && block.images.length > 1)

const renderTabs = (images: Image[], alt: string) =>
  `<Tabs groupId="platform">\n${images
    .map(
      ({ platform = "", file }) =>
        `  <TabItem value="${platform}" label="${platformLabel(platform)}">\n\n![${alt}](./${file})\n\n  </TabItem>\n`,
    )
    .join("")}</Tabs>\n\n`

/**
 * Renders a guide as markdown: an h1 for the flow, an h2 per section,
 * numbered instructions with their screenshots nested under them, and
 * markdown blocks written out as they are. A screenshot taken on several
 * platforms becomes Docusaurus tabs, one per platform.
 */
export const renderMarkdown = (name: string, guide: Guide) => {
  const renderBlocks = (blocks: GuideBlock[], fallbackAlt: string) => {
    let markdown = ""
    let step = 0
    let previous: GuideBlock | undefined

    for (const block of blocks) {
      switch (block.type) {
        case "instruction":
          markdown += `${++step}. ${block.text}\n\n`
          break
        case "markdown":
          markdown += `${block.text}\n\n`
          break
        case "screenshot": {
          const follows =
            previous?.type === "instruction" ? previous : undefined
          const alt = follows?.text ?? fallbackAlt
          const [only] = block.images
          if (block.images.length > 1) {
            markdown += renderTabs(block.images, alt)
          } else if (only) {
            const indent = follows ? " ".repeat(`${step}. `.length) : ""
            markdown += `${indent}![${alt}](./${only.file})\n\n`
          }
          break
        }
      }
      previous = block
    }

    return markdown
  }

  const tabs = hasTabs([
    ...guide.blocks,
    ...guide.sections.flatMap((s) => s.blocks),
  ])
  let markdown = tabs
    ? 'import Tabs from "@theme/Tabs"\nimport TabItem from "@theme/TabItem"\n\n'
    : ""
  markdown += `# ${name}\n\n${renderBlocks(guide.blocks, name)}`

  for (const section of guide.sections) {
    markdown += `## ${section.title}\n\n${renderBlocks(section.blocks, section.title)}`
  }

  return markdown
}
