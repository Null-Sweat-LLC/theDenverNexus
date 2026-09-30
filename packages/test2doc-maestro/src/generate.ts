import crypto from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import { annotatePng } from "./annotate.js"
import { mergeFlows } from "./mergeFlows.js"
import { parseFlow } from "./parseFlow.js"
import { renderMarkdown } from "./renderMarkdown.js"
import { detectScale, matchTaps, parseTaps } from "./taps.js"
import type { CommandEntry, Flow } from "./types.js"
import { convertToKebabCase } from "./utils.js"

export interface GenerateInput {
  /** The directory passed to `maestro test --test-output-dir` */
  dir: string
  /** Which platform this run was on. Required when there are several inputs. */
  platform?: string
  /**
   * Screenshot pixels per unit of the bounds Maestro logs. Android and web use
   * pixels (1). iOS uses points: it is worked out from the screenshot if not given.
   */
  scale?: number
}

export interface GenerateOptions {
  inputs: GenerateInput[]
  outputDir: string
}

export interface GenerateResult {
  pages: number
  screenshots: number
  /** Things that were skipped rather than failed, such as a highlight */
  warnings: string[]
}

const findCommandFiles = (inputDir: string) =>
  readdirSync(inputDir, { recursive: true, encoding: "utf8" })
    .filter((file) => basename(file) === "commands.json")
    .sort()

const validateInputs = (inputs: GenerateInput[]) => {
  if (inputs.length === 0) throw new Error("No input directories given")
  if (inputs.length === 1) return

  const platforms = inputs.map((input) => input.platform)
  if (platforms.some((platform) => !platform)) {
    throw new Error(
      "With several inputs, give each one a platform, like --input web=<dir>",
    )
  }
  const duplicate = platforms.find((p, i) => platforms.indexOf(p) !== i)
  if (duplicate)
    throw new Error(`Platform "${duplicate}" is given more than once`)
}

interface Run {
  platform?: string
  flow: Flow
  files: Record<string, string>
  shots: Map<string, Buffer>
}

/** Reads every flow in one input. When a flow ran more than once, the latest run wins. */
const readRuns = (
  { dir, platform, scale }: GenerateInput,
  warnings: string[],
) => {
  const commandFiles = findCommandFiles(dir)
  if (commandFiles.length === 0) {
    throw new Error(`No commands.json found in ${dir}`)
  }

  const runs = new Map<string, Run>()
  for (const file of commandFiles) {
    const flowDir = join(dir, dirname(file))
    const name = basename(flowDir)
    const entries: CommandEntry[] = JSON.parse(
      readFileSync(join(dir, file), "utf8"),
    )

    try {
      const logFile = join(flowDir, "logs", "maestro.log")
      const taps = existsSync(logFile)
        ? parseTaps(readFileSync(logFile, "utf8"))
        : []
      const flow = parseFlow(entries, matchTaps(entries, taps))
      const files: Record<string, string> = {}
      const shots = new Map<string, Buffer>()
      const blocks = [flow.blocks, ...flow.sections.map((s) => s.blocks)].flat()

      for (const block of blocks) {
        if (block.type !== "screenshot") continue
        let buffer: Buffer = readFileSync(join(flowDir, block.path))

        if (block.highlights?.length) {
          const pixelScale = detectScale(taps, buffer.readUInt32BE(16), scale)
          if (pixelScale) {
            buffer = annotatePng(buffer, block.highlights, pixelScale)
          } else {
            warnings.push(
              `Flow "${name}"${platform ? ` on ${platform}` : ""}: could not work out the iOS screen scale, so the highlights were skipped. Give it, like ${platform ?? "ios"}@3=<dir>`,
            )
          }
        }

        const hash = crypto.createHash("sha256").update(buffer).digest("hex")
        const outputName = `test2doc-${hash.slice(0, 12)}.png`
        files[block.path] = outputName
        shots.set(outputName, buffer)
      }

      runs.set(name, { ...(platform ? { platform } : {}), flow, files, shots })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Flow "${name}": ${reason}`)
    }
  }
  return runs
}

/**
 * Reads the artifacts of `maestro test --test-output-dir` runs and writes one
 * Docusaurus page per flow, plus its screenshots, into `outputDir`.
 * Give one input per platform to get a single page per flow, with each
 * screenshot as tabs, one per platform.
 */
export const generateDocs = ({
  inputs,
  outputDir,
}: GenerateOptions): GenerateResult => {
  validateInputs(inputs)

  const warnings: string[] = []
  const byFlow = new Map<string, Run[]>()
  for (const input of inputs) {
    for (const [name, run] of readRuns(input, warnings)) {
      byFlow.set(name, [...(byFlow.get(name) ?? []), run])
    }
  }

  const pages = new Map<
    string,
    { markdown: string; shots: Map<string, Buffer> }
  >()
  for (const [name, runs] of byFlow) {
    try {
      const guide = mergeFlows(runs)
      pages.set(name, {
        markdown: renderMarkdown(name, guide),
        shots: new Map(runs.flatMap((run) => [...run.shots])),
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

  return { pages: pages.size, screenshots: screenshots.size, warnings }
}
