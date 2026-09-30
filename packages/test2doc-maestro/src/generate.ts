import crypto from "node:crypto"
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import { parseFlow } from "./parseFlow.js"
import { renderMarkdown } from "./renderMarkdown.js"
import type { CommandEntry } from "./types.js"
import { convertToKebabCase } from "./utils.js"

export interface GenerateOptions {
  /** The directory passed to `maestro test --test-output-dir` */
  inputDir: string
  outputDir: string
}

export interface GenerateResult {
  pages: number
  screenshots: number
}

const findCommandFiles = (inputDir: string) =>
  readdirSync(inputDir, { recursive: true, encoding: "utf8" })
    .filter((file) => basename(file) === "commands.json")
    .sort()

/**
 * Reads the artifacts of a `maestro test --test-output-dir` run and writes
 * one Docusaurus page per flow, plus its screenshots, into `outputDir`.
 * When the same flow appears in several runs, the latest run wins.
 */
export const generateDocs = ({
  inputDir,
  outputDir,
}: GenerateOptions): GenerateResult => {
  const commandFiles = findCommandFiles(inputDir)
  if (commandFiles.length === 0) {
    throw new Error(`No commands.json found in ${inputDir}`)
  }

  const pages = new Map<
    string,
    { markdown: string; shots: Map<string, Buffer> }
  >()

  for (const file of commandFiles) {
    const flowDir = join(inputDir, dirname(file))
    const name = basename(flowDir)
    const entries: CommandEntry[] = JSON.parse(
      readFileSync(join(inputDir, file), "utf8"),
    )

    try {
      const flow = parseFlow(entries)
      const outputNames: Record<string, string> = {}
      const shots = new Map<string, Buffer>()
      const paths = [flow.blocks, ...flow.sections.map((s) => s.blocks)]
        .flat()
        .flatMap((block) => (block.type === "screenshot" ? [block.path] : []))

      for (const path of paths) {
        const buffer = readFileSync(join(flowDir, path))
        const hash = crypto.createHash("sha256").update(buffer).digest("hex")
        const outputName = `test2doc-${hash.slice(0, 12)}.png`
        outputNames[path] = outputName
        shots.set(outputName, buffer)
      }

      pages.set(name, {
        markdown: renderMarkdown(name, flow, outputNames),
        shots,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Flow "${name}": ${reason}`)
    }
  }

  // Only touch the output once every flow parsed, so a failed run keeps the old docs
  mkdirSync(outputDir, { recursive: true })
  for (const file of readdirSync(outputDir)) {
    if (file.startsWith("test2doc-")) unlinkSync(join(outputDir, file))
  }

  const screenshots = new Set<string>()
  for (const [name, page] of pages) {
    writeFileSync(
      join(outputDir, `test2doc-${convertToKebabCase(name)}.mdx`),
      page.markdown,
    )
    for (const [outputName, buffer] of page.shots) {
      writeFileSync(join(outputDir, outputName), buffer)
      screenshots.add(outputName)
    }
  }

  return { pages: pages.size, screenshots: screenshots.size }
}
