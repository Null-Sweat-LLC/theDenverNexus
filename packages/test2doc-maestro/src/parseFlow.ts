import type { Block, CommandEntry, Flow, Section } from "./types.js"
import { CALLOUT_KINDS, type CalloutKind } from "./types.js"

const commandName = (entry: CommandEntry) => Object.keys(entry.command)[0] ?? ""

// Maestro only resolves variables in some labels, so prefer the resolved one
const labelOf = (entry: CommandEntry, name: string) =>
  entry.metadata.evaluatedCommand?.[name]?.label ?? entry.command[name]?.label

const PREFIXED_LABEL = /^\[(\w+)\]\s*(.*)$/s

const blockFromLabel = (label: string): Block => {
  const [, prefix = "", rest = ""] = label.match(PREFIXED_LABEL) ?? []
  const kind = prefix.toLowerCase()

  if (kind === "text") return { type: "text", text: rest }
  if ((CALLOUT_KINDS as readonly string[]).includes(kind)) {
    return { type: "callout", kind: kind as CalloutKind, text: rest }
  }
  return { type: "instruction", text: label }
}

/**
 * Turns the commands Maestro recorded for one flow into a guide.
 * A labeled `runFlow` starts a section. Any other labeled command becomes an
 * instruction, or a callout or paragraph when its label starts with a
 * `[note]`-style prefix. Completed screenshots are added in sequence.
 * Blocks go to the nearest section above them.
 */
export const parseFlow = (entries: CommandEntry[]): Flow => {
  const ordered = [...entries].sort(
    (a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber,
  )
  const flow: Flow = { blocks: [], sections: [] }
  const open: { depth: number; section: Section }[] = []

  const add = (block: Block, depth: number) => {
    const owner = open.findLast((entry) => depth > entry.depth)
    ;(owner?.section.blocks ?? flow.blocks).push(block)
  }

  for (const entry of ordered) {
    const name = commandName(entry)
    const { status, depth } = entry.metadata

    if (status === "FAILED") {
      throw new Error(
        `Command ${name} failed (sequence ${entry.metadata.sequenceNumber})`,
      )
    }
    if (status !== "COMPLETED") continue

    if (name === "takeScreenshotCommand") {
      const path = entry.metadata.artifacts?.find(
        (artifact) => artifact.type === "TAKE_SCREENSHOT",
      )?.path
      if (path) add({ type: "screenshot", path }, depth)
      continue
    }

    const label = labelOf(entry, name)
    if (!label) continue

    if (name === "runFlowCommand") {
      while (open.length > 0 && (open.at(-1)?.depth ?? 0) >= depth) open.pop()
      const section: Section = { title: label, blocks: [] }
      open.push({ depth, section })
      flow.sections.push(section)
      continue
    }

    add(blockFromLabel(label), depth)
  }

  return flow
}
