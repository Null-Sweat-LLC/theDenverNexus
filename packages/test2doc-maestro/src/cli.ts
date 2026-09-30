import { parseArgs } from "node:util"
import { loadConfig } from "./config.js"
import { generateDocs } from "./generate.js"

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

const USAGE = `Usage: test2doc-maestro --input [platform[@scale]=]<dir> [--output <dir>]

Generate Docusaurus docs from a Maestro run.

Run your flows with the test output directory set, and TEST2DOC=true so the
flows take their doc screenshots:

  maestro test -e TEST2DOC=true --test-output-dir maestro-output .maestro
  test2doc-maestro --input maestro-output --output docs

To document several platforms on one page, run the same flow on each and give
one labeled input per platform. Screenshots become tabs:

  test2doc-maestro -i android=output/android -i web=output/web -o docs

Steps that tap an element are marked on the screenshot taken before them, with the
step's words as a label, like @test2doc/playwright's annotations. Style them, or turn
on arrows, with a config file:

  test2doc-maestro -i android=output/android -o docs --config test2doc-maestro.config.json

Maestro reports iOS positions in points, so the scale (screenshot pixels per point,
usually 3 on iPhones) is worked out from the screenshot's width, or given:

  test2doc-maestro -i ios@3=output/ios -o docs

Options:
  -i, --input <[platform[@scale]=]dir>  Directory passed to \`maestro test --test-output-dir\`.
                                Repeat it, with a platform for each, for several platforms. (required)
  -o, --output <dir>            Where to write the docs (default: ./docs)
  -c, --config <file>           JSON with annotationDefaults, to style the annotations
  -h, --help                    Show this help
`

const LABELED_INPUT = /^([A-Za-z][\w-]*)(?:@(\d+(?:\.\d+)?))?=(.+)$/s

const parseInput = (value: string) => {
  const [, platform, scale, dir] = value.match(LABELED_INPUT) ?? []
  if (!platform || !dir) return { dir: value }
  return { platform, dir, ...(scale ? { scale: Number(scale) } : {}) }
}

export const run = (argv: string[], io: CliIo): number => {
  let values: {
    input?: string[]
    output?: string
    config?: string
    help?: boolean
  }
  try {
    values = parseArgs({
      args: argv,
      options: {
        input: { type: "string", short: "i", multiple: true },
        output: { type: "string", short: "o" },
        config: { type: "string", short: "c" },
        help: { type: "boolean", short: "h" },
      },
    }).values
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : error}\n\n${USAGE}`)
    return 1
  }

  if (values.help) {
    io.stdout(USAGE)
    return 0
  }

  if (!values.input || values.input.length === 0) {
    io.stderr(`Missing required option --input\n\n${USAGE}`)
    return 1
  }

  try {
    const { annotationDefaults } = values.config
      ? loadConfig(values.config)
      : { annotationDefaults: {} }
    const { pages, screenshots, warnings } = generateDocs({
      annotationDefaults,
      inputs: values.input.map(parseInput),
      outputDir: values.output ?? "./docs",
    })
    for (const warning of warnings) io.stderr(`warning: ${warning}\n`)
    io.stdout(
      `Generated ${pages} page${pages === 1 ? "" : "s"} and ${screenshots} screenshot${screenshots === 1 ? "" : "s"}\n`,
    )
    return 0
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : error}\n`)
    return 1
  }
}
