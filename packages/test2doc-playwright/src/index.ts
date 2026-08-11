import crypto from "node:crypto"
import {
  mkdirSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from "@playwright/test/reporter"
import type {
  DocusaurusCategoryMetadata,
  DocusaurusHeaderConfig,
  metadataType,
} from "./DocMeta.js"
import { activateTest2Doc } from "./DocMeta.js"
import { convertToKebabCase } from "./utils.js"

interface DocNode {
  title: string
  children: DocNode[]
  tests?: DocTest[]
}

interface DocScreenshot {
  name: string // name of the screenshot file
  buffer: Buffer // buffer of the screenshot image
}

interface DocTest {
  title: string
  steps: Array<{
    title?: string
    screenshot?: DocScreenshot
    markdown?: string
  }>
}

interface Test2DocReporterOptions {
  outputDir?: string
}

type ExtractDocMetadataPage = [string, DocusaurusHeaderConfig, "page"]

type ExtractDocMetadataCategory = [
  string,
  DocusaurusCategoryMetadata,
  "category",
]

type ExtractedDocMetadataUnspecified = [
  string,
  Record<string, unknown>,
  undefined,
]

type ExtractedDocMetadata =
  | ExtractDocMetadataPage
  | ExtractDocMetadataCategory
  | ExtractedDocMetadataUnspecified

// TODO: remove this later, here right now as a hacky solution for testing
activateTest2Doc()

/**
 * Test2DocReporter is a Playwright reporter that generates documentation
 * for tests in markdown and consumed by Docusaurus.
 */
class Test2DocReporter implements Reporter {
  private docs: DocNode[] = []
  private docMap: Map<string, DocTest | DocNode> = new Map()
  private outputDir: string
  private screenshotMoveQueue: DocScreenshot[] = []
  private seenScreenshot = new Set<string>()
  private seenMarkdown = new Set<string>()
  private totalTests = 0
  private completedTests = 0
  private testResults: ("P" | "F" | "S" | ".")[] = []

  constructor(
    options: Test2DocReporterOptions = {
      outputDir: "./docs",
    },
  ) {
    this.outputDir = options.outputDir || "./docs"
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.docs = []
    this.docMap.clear()
    let setupTestsCount = 0
    this.docs = suite.suites.flatMap(
      (project) =>
        project.suites.flatMap(({ suites, tests, title }) => {
          // If this is a setup file, we'll only count it for progress but will not generate docs
          if (/\.setup\.[jt]s$/.test(title)) {
            const countSuiteTests = (acc: number, suite: Suite): number =>
              suite.suites.reduce(countSuiteTests, acc + suite.tests.length)

            setupTestsCount += suites.reduce(countSuiteTests, tests.length)
            return []
          }

          return [
            ...suites.map((s) => this.buildDocTree(s)),
            ...(tests.length > 0 ? [this.buildTestDocTree(title, tests)] : []),
          ]
        }) || [],
    )
    this.testResults = new Array(this.totalTests + setupTestsCount).fill(".")

    writeLine(
      `Starting documentation generation for ${this.totalTests} tests...`,
    )
    writeLine(`Found ${this.docs.length} documentation sections\n`)
    this.updateProgressBar()
  }

  private buildTestDocTree(filename: string, tests: TestCase[]): DocNode {
    const title =
      filename.match(/^(.*?)\.(test|spec)\.(ts|js)$/)?.[1] ?? filename
    const docNode: DocNode = {
      title,
      children: [],
      tests: this.buildDocTests(tests),
    }

    return docNode
  }

  private buildDocTests(tests: TestCase[]): DocTest[] {
    return tests.map((test) => {
      ++this.totalTests
      const testDoc: DocTest = {
        title: test.title,
        steps: [],
      }
      this.docMap.set(test.id, testDoc)
      return testDoc
    })
  }

  private buildDocTree(suite: Suite) {
    const docNode: DocNode = {
      title: suite.title,
      children: [],
    }

    for (const child of suite.suites) {
      const childDocNode = this.buildDocTree(child)
      this.docMap.set(child.title, childDocNode)
      docNode.children.push(childDocNode)
    }

    if (suite.tests.length > 0) {
      docNode.tests = this.buildDocTests(suite.tests)
    }

    return docNode
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    const docSection = this.docMap.get(test.id)
    if (
      docSection &&
      step.category === "test.step" &&
      "steps" in docSection &&
      !step.title.startsWith("[nodoc]")
    ) {
      docSection.steps.push({ title: step.title })
    }
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    const now = Date.now()
    const docSection = this.docMap.get(test.id)
    if (docSection && step.category === "test.step" && "steps" in docSection) {
      for (const attachment of result.attachments) {
        if (!attachment?.body) continue

        const screenshotMatch = attachment.name.match(/test2doc-(\d+)-\d+\.png/)
        const markdownMatch = attachment.name.match(
          /test2doc-markdown-(\d+)-\d+\.md/,
        )

        if (screenshotMatch) {
          const screenshotTime = +(screenshotMatch[1] ?? 0)
          if (
            screenshotTime < now &&
            !this.seenScreenshot.has(attachment.name)
          ) {
            this.seenScreenshot.add(attachment.name)
            docSection.steps.push({
              screenshot: { name: attachment.name, buffer: attachment.body },
            })
          }
        } else if (markdownMatch) {
          const markdownTime = +(markdownMatch[1] ?? 0)
          if (markdownTime < now && !this.seenMarkdown.has(attachment.name)) {
            this.seenMarkdown.add(attachment.name)
            docSection.steps.push({ markdown: attachment.body.toString() })
          }
        }
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "passed") {
      this.testResults[this.completedTests] = "P"
    } else if (result.status === "failed" || result.status === "timedOut") {
      this.testResults[this.completedTests] = "F"
      this.updateProgressBar()
      writeLine(
        `\n\nDocumentation generation aborted due to test failure: ${test.title}`,
      )

      for (const error of result.errors) {
        if (error.stack) {
          writeLine(error.stack)
        } else if (error.message) {
          writeLine(error.message)
        } else if (error.value) {
          writeLine(error.value)
        }
      }

      for (const line of result.stderr) {
        writeLine(typeof line === "string" ? line : line.toString())
      }

      if (!process.env.IGNORE_TEST_FAILURES) {
        process.exit(1)
      }
    } else if (result.status === "skipped") {
      this.testResults[this.completedTests] = "S"
    }

    this.completedTests++
    this.updateProgressBar()
  }

  private updateProgressBar() {
    // Move cursor to beginning of line and clear it
    process.stdout.write("\r\x1b[K")

    const total = this.testResults.length
    const percentage = Math.round((this.completedTests / total) * 100)
    const suffix = ` ${this.completedTests}/${total} (${percentage}%)`

    // Leave room for the brackets and the trailing "n/n (pct%)" text
    const terminalWidth = process.stdout.columns || 80
    const maxBarWidth = Math.max(1, terminalWidth - suffix.length - 2)
    const barWidth = Math.min(total, maxBarWidth)

    const bar =
      barWidth >= total
        ? this.testResults.join("")
        : this.scaleProgressBar(barWidth)

    process.stdout.write(`[${bar}]${suffix}`)
  }

  private scaleProgressBar(barWidth: number): string {
    const total = this.testResults.length
    // Worse statuses take priority when multiple tests are collapsed into one slot
    const rank: Record<"." | "S" | "P" | "F", number> = {
      ".": 0,
      S: 1,
      P: 2,
      F: 3,
    }

    let bar = ""
    for (let slot = 0; slot < barWidth; slot++) {
      const start = Math.floor((slot * total) / barWidth)
      const end = Math.floor(((slot + 1) * total) / barWidth)

      let worst: "." | "S" | "P" | "F" = "."
      for (let i = start; i < end; i++) {
        const result = this.testResults[i]
        if (result !== undefined && rank[result] > rank[worst]) {
          worst = result
        }
      }
      bar += worst
    }

    return bar
  }

  onEnd() {
    writeLine("\n")

    writeLine("Cleaning up old generated files...")
    this.cleanupTest2DocFiles(this.outputDir)

    writeLine("Generating documentation files...")
    this.docs.forEach((doc) => {
      this.buildDocFiles(doc)
    })
    writeLine("Documentation generation completed.")
    writeLine(`Output directory: ${this.outputDir}`)
    writeLine(`Processed ${this.seenScreenshot.size} screenshots`)
  }

  private buildDocFiles(doc: DocNode, outputDir: string = this.outputDir) {
    const [title, metadata, metaType] = this.extractDocMetadata(doc.title)

    if (metaType === "page") {
      const markdownHeader = this.generateHeader(metadata)
      const markdown =
        markdownHeader + this.generateMarkdown({ ...doc, title }, 1)
      const filePath = `${outputDir}/test2doc-${convertToKebabCase(title)}.mdx`
      writeFileSync(filePath, markdown)
      this.generateScreenshots(outputDir)
    } else if (metaType === "category") {
      const filePath = `${outputDir}/test2doc-${convertToKebabCase(title)}`
      mkdirSync(filePath, { recursive: true })

      writeFileSync(
        `${filePath}/_category_.json`,
        JSON.stringify(metadata, null, 2),
      )
      doc.children.forEach((child) => {
        this.buildDocFiles(child, filePath)
      })
      this.generateScreenshots(filePath)
    } else {
      const markdown = this.generateMarkdown(doc, 1)
      const filePath = `${outputDir}/test2doc-${convertToKebabCase(doc.title)}.mdx`
      writeFileSync(filePath, markdown)
      this.generateScreenshots(outputDir)
    }
  }

  private generateHashedScreenshotFilename(image: Buffer): string {
    return `test2doc-${crypto.createHash("sha256").update(image).digest("hex").slice(0, 12)}.png`
  }

  private generateScreenshots(output: string) {
    this.screenshotMoveQueue.forEach(({ buffer }) => {
      const filename = this.generateHashedScreenshotFilename(buffer)
      const dest = `${output}/${filename}`
      writeFileSync(dest, buffer)
    })
    this.screenshotMoveQueue = []
  }

  private cleanupTest2DocFiles(output: string) {
    for (const file of readdirSync(output)) {
      const filePath = join(output, file)
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        this.cleanupTest2DocFiles(filePath)
        const filesInDir = readdirSync(filePath)
        if (filesInDir.length === 0) {
          rmdirSync(filePath)
        } else if (
          filesInDir.length === 1 &&
          filesInDir.at(0) === "_category_.json"
        ) {
          rmSync(filePath, { recursive: true, force: true })
        }
      } else if (stat.isFile() && file.startsWith("test2doc-")) {
        unlinkSync(filePath)
      }
    }
  }

  private extractDocMetadata(docTitle: string): ExtractedDocMetadata {
    const [_ignore, title, metaType, metadataJson] =
      docTitle.match(/^(.*?)\[test2doc_(.+)\]:(.+)$/) ?? []

    return [
      title ?? docTitle,
      metadataJson ? JSON.parse(metadataJson) : {},
      metaType as metadataType,
    ]
  }

  private generateHeader(metadata: DocusaurusHeaderConfig): string {
    let header = "---\n"
    for (const [key, value] of Object.entries(metadata)) {
      switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
          header += `${key}: ${value}\n`
          break
        case "object":
          if (Array.isArray(value)) {
            header += `${key}:\n`
            for (const item of value) {
              header += `  - ${item}\n`
            }
          } else {
            header += `${key}:\n`
            for (const [subKey, subValue] of Object.entries(value)) {
              header += `  ${subKey}: ${subValue}\n`
            }
          }
          break
        default:
          writeLine(
            `Unsupported metadata type for key "${key}": ${typeof value}`,
          )
          break
      }
    }
    header += "---\n\n"
    return header
  }

  private generateTitle(title: string, depth: number): string {
    return `${"#".repeat(depth)} ${title}\n\n`
  }

  private parseScreenshotMetadata(screenshotName: string): {
    caption?: string
    figure?: boolean
  } {
    // Check for JSON metadata format: filename.png[test2doc_screenshot]:{"figure":true,"caption":"text"}
    const jsonMatch = screenshotName.match(/\[test2doc_screenshot\]:(.+)$/)
    if (jsonMatch?.[1]) {
      try {
        return JSON.parse(jsonMatch[1])
      } catch {
        // If JSON parsing fails, fall through to legacy format
      }
    }

    // Legacy format: filename.png:altText
    const [, caption] = screenshotName.split(":") ?? []
    return caption ? { caption } : {}
  }

  private generateMarkdown(docNode: DocNode, depth: number): string {
    let markdown = this.generateTitle(docNode.title, depth)

    if (docNode.tests) {
      for (const test of docNode.tests) {
        markdown += this.generateTitle(test.title, depth + 1)
        if (test.steps.length > 0) {
          for (const step of test.steps) {
            if (step.title) {
              markdown += `${step.title}\n`
            }
            if (step.markdown) {
              markdown += `\n${step.markdown.trim()}\n\n`
            }
            if (step.screenshot) {
              this.screenshotMoveQueue.push(step.screenshot)
              const transformedFilename = this.generateHashedScreenshotFilename(
                step.screenshot.buffer,
              )

              // Parse screenshot metadata (supports both legacy :altText and new JSON format)
              const { caption, figure } = this.parseScreenshotMetadata(
                step.screenshot.name,
              )

              if (figure) {
                // Generate figure/figcaption format
                const altText = caption ?? "screenshot"
                markdown += `<figure>

![${altText}](./${transformedFilename})${
                  caption
                    ? `
<figcaption>${caption}</figcaption>`
                    : ""
                }
</figure>
`
              } else {
                // Generate standard markdown image
                markdown += `![${caption ?? "screenshot"}](./${transformedFilename})\n`
              }
            }
          }
          markdown += "\n"
        }
      }
    }

    if (docNode.children.length > 0) {
      for (const child of docNode.children) {
        markdown += this.generateMarkdown(child, depth + 1)
      }
    }

    return markdown
  }
}

function writeLine(line: string) {
  // eslint-disable-next-line no-restricted-properties
  process.stdout.write(`${line}\n`)
}

export default Test2DocReporter
