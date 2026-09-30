export interface CommandEntry {
  command: Record<string, { label?: string } | undefined>
  metadata: {
    status: string
    sequenceNumber: number
    depth: number
    evaluatedCommand?: Record<string, unknown>
    artifacts?: { type: string; path: string }[]
  }
}

export interface FlowStep {
  title: string
  screenshots: string[]
}

export interface Flow {
  // screenshots taken before the first labeled section
  screenshots: string[]
  steps: FlowStep[]
}
