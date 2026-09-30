import { parseAnnotationLabel, plainText } from "./annotation.js"
import type { Block, Bounds, CommandEntry, Flow, Section } from "./types.js"

const commandName = (entry: CommandEntry) => Object.keys(entry.command)[0] ?? ""

// Maestro only resolves variables in some labels, so prefer the resolved one
const labelOf = (entry: CommandEntry, name: string) =>
  entry.metadata.evaluatedCommand?.[name]?.label ?? entry.command[name]?.label

/**
 * Turns the commands Maestro recorded for one flow into a guide.
 * A labeled `runFlow` starts a section. A labeled `evalScript` is a markdown
 * block, written to the page as is. Any other labeled command is an
 * instruction. Completed screenshots are added in sequence, and every block
 * goes to the nearest section above it.
 * `tapped` holds the bounds each tap command hit, by sequence number. A
 * labeled tap highlights its element on the nearest screenshot above it in
 * the same section, annotated with the step's words.
 */
export const parseFlow = (
  entries: CommandEntry[],
  tapped: Map<number, Bounds> = new Map(),
): Flow => {
  const ordered = [...entries].sort(
    (a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber,
  )
  const flow: Flow = { blocks: [], sections: [] }
  const open: { depth: number; section: Section }[] = []

  let lastShot: { block: Block; blocks: Block[] } | undefined

  const add = (block: Block, depth: number) => {
    const owner = open.findLast((entry) => depth > entry.depth)
    const blocks = owner?.section.blocks ?? flow.blocks
    blocks.push(block)
    return blocks
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
      if (path) {
        const block: Block = { type: "screenshot", path }
        lastShot = { block, blocks: add(block, depth) }
      }
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

    if (name === "evalScriptCommand") {
      add({ type: "markdown", text: label.trim() }, depth)
      continue
    }

    const { text, options } = parseAnnotationLabel(label)
    const blocks = add({ type: "instruction", text }, depth)
    const bounds = tapped.get(entry.metadata.sequenceNumber)
    if (
      bounds &&
      lastShot?.blocks === blocks &&
      lastShot.block.type === "screenshot"
    ) {
      lastShot.block.highlights = [
        ...(lastShot.block.highlights ?? []),
        { bounds, text: plainText(text), ...(options ? { options } : {}) },
      ]
    }
  }

  return flow
}
