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

export const CALLOUT_KINDS = [
  "note",
  "tip",
  "info",
  "warning",
  "danger",
] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

export type Block =
  | { type: "instruction"; text: string }
  | { type: "text"; text: string }
  | { type: "callout"; kind: CalloutKind; text: string }
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
