import type { CommandEntry, Flow, FlowStep } from "./types.js"

const commandName = (entry: CommandEntry) => Object.keys(entry.command)[0] ?? ""

/**
 * Turns the commands Maestro recorded for one flow into doc steps.
 * Each labeled `runFlow` becomes a step, and each completed `takeScreenshot`
 * goes to the nearest labeled section above it.
 */
export const parseFlow = (entries: CommandEntry[]): Flow => {
  const ordered = [...entries].sort(
    (a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber,
  )
  const flow: Flow = { screenshots: [], steps: [] }
  const open: { depth: number; step: FlowStep }[] = []

  for (const entry of ordered) {
    const name = commandName(entry)
    const { status, depth } = entry.metadata

    if (status === "FAILED") {
      throw new Error(
        `Command ${name} failed (sequence ${entry.metadata.sequenceNumber})`,
      )
    }

    const label = entry.command[name]?.label
    if (name === "runFlowCommand" && label) {
      while (open.length > 0 && (open.at(-1)?.depth ?? 0) >= depth) open.pop()
      const step: FlowStep = { title: label, screenshots: [] }
      open.push({ depth, step })
      flow.steps.push(step)
      continue
    }

    if (name === "takeScreenshotCommand" && status === "COMPLETED") {
      const path = entry.metadata.artifacts?.find(
        (artifact) => artifact.type === "TAKE_SCREENSHOT",
      )?.path
      if (!path) continue
      const owner = open.findLast((section) => section.depth < depth)
      ;(owner?.step.screenshots ?? flow.screenshots).push(path)
    }
  }

  return flow
}
