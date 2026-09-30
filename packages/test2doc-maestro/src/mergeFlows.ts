import type { Flow, Guide, GuideBlock, Block } from "./types.js"

export interface Variant {
  platform?: string
  flow: Flow
  /** Maps a screenshot's path in the run output to its file name in the docs */
  files: Record<string, string>
}

/**
 * Combines the runs of one flow, one per platform, into a single guide.
 * The platforms must have run the same flow, so text and steps are taken
 * from the first and each screenshot collects one image per platform.
 */
export const mergeFlows = (variants: Variant[]): Guide => {
  const [first, ...rest] = variants
  if (!first) throw new Error("No flows to merge")

  const signature = JSON.stringify(first.flow)
  for (const other of rest) {
    if (JSON.stringify(other.flow) !== signature) {
      throw new Error(
        `The flow differs between ${first.platform ?? "platform 1"} and ${other.platform ?? "platform 2"}. ` +
          "Both platforms must run the same flow with the same labels and screenshots.",
      )
    }
  }

  const resolve = (block: Block): GuideBlock => {
    if (block.type !== "screenshot") return block
    return {
      type: "screenshot",
      images: variants.map(({ platform, files }) => {
        const file = files[block.path]
        if (!file)
          throw new Error(`No output file for screenshot ${block.path}`)
        return platform ? { platform, file } : { file }
      }),
    }
  }

  return {
    blocks: first.flow.blocks.map(resolve),
    sections: first.flow.sections.map((section) => ({
      title: section.title,
      blocks: section.blocks.map(resolve),
    })),
  }
}
