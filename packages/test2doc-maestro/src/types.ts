export interface CommandEntry {
  command: Record<string, { label?: string } | undefined>
  metadata: {
    status: string
    sequenceNumber: number
    depth: number
    evaluatedCommand?: Record<string, { label?: string } | undefined>
    artifacts?: { type: string; path: string }[]
  }
}

export type Block =
  | { type: "instruction"; text: string }
  | { type: "markdown"; text: string }
  | { type: "screenshot"; path: string }

export interface Section {
  title: string
  blocks: Block[]
}

export interface Flow {
  // blocks that come before the first section
  blocks: Block[]
  sections: Section[]
}

export interface Image {
  platform?: string
  file: string
}

export type GuideBlock =
  | Exclude<Block, { type: "screenshot" }>
  | { type: "screenshot"; images: Image[] }

export interface GuideSection {
  title: string
  blocks: GuideBlock[]
}

/** A flow ready to render, with its screenshots resolved to output files */
export interface Guide {
  blocks: GuideBlock[]
  sections: GuideSection[]
}
