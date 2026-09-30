import { parseArgs } from "node:util"
import { generateDocs } from "./generate.js"

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

const USAGE = `Usage: test2doc-maestro --input <dir> [--output <dir>]

Generate Docusaurus docs from a Maestro run.

Run your flows with the test output directory set, and TEST2DOC=true so the
flows take their doc screenshots:

  maestro test -e TEST2DOC=true --test-output-dir maestro-output .maestro
  test2doc-maestro --input maestro-output --output docs

Options:
  -i, --input <dir>    Directory passed to \`maestro test --test-output-dir\` (required)
  -o, --output <dir>   Where to write the docs (default: ./docs)
  -h, --help           Show this help
`

export const run = (argv: string[], io: CliIo): number => {
  let values: { input?: string; output?: string; help?: boolean }
  try {
    values = parseArgs({
      args: argv,
      options: {
        input: { type: "string", short: "i" },
        output: { type: "string", short: "o" },
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

  if (!values.input) {
    io.stderr(`Missing required option --input\n\n${USAGE}`)
    return 1
  }

  try {
    const { pages, screenshots } = generateDocs({
      inputDir: values.input,
      outputDir: values.output ?? "./docs",
    })
    io.stdout(
      `Generated ${pages} page${pages === 1 ? "" : "s"} and ${screenshots} screenshot${screenshots === 1 ? "" : "s"}\n`,
    )
    return 0
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : error}\n`)
    return 1
  }
}
