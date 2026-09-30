import type { AnnotationOptions } from "./annotation.js"

export interface Selector {
  idRegex?: string
  textRegex?: string
}

type CommandBody = { label?: string; selector?: Selector } | undefined

export interface CommandEntry {
  command: Record<string, CommandBody>
  metadata: {
    status: string
    sequenceNumber: number
    depth: number
    evaluatedCommand?: Record<string, CommandBody>
    artifacts?: { type: string; path: string }[]
  }
}

/** The edges of an element on screen, in the units Maestro reports them in */
export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** An element a step taps, to mark on the screenshot and label with the step's words */
export interface Highlight {
  bounds: Bounds
  /** The step's words as plain text */
  text: string
  /** Annotation options from the step's label, over the config's defaults */
  options?: AnnotationOptions
}

export type Block =
  | { type: "instruction"; text: string }
  | { type: "markdown"; text: string }
  | { type: "screenshot"; path: string; highlights?: Highlight[] }

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
