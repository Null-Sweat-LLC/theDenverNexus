import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest"
import type { FullConfig, Suite, TestResult } from "@playwright/test/reporter"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { withDocMeta } from "./DocMeta.js"
import {
  setup,
  tempDir,
  testCleanup,
  mockSuiteForPages,
  mockSuiteForCategories,
  mockTestSuccess,
  mockTestFail,
  mockTestPrivacyPolicyLogin,
  mockTestPrivacyPolicyRegistration,
  mockStep,
  baseSuite,
  mockSuiteWithMultiProjects,
  mockTestNewUserRegistration,
  mockTestLoggedInUser,
  mockTestLoggedOutUser,
  mockSingleSetupFileSuite,
  mockSetupTest,
  mockAuthenticatedTest,
} from "./testUtils/index.js"

const mockFullConfig: FullConfig = {} as FullConfig

function createMockTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    attachments: [],
    annotations: [],
    duration: 0,
    errors: [],
    parallelIndex: 0,
    workerIndex: 0,
    status: "passed",
    stdout: [],
    stderr: [],
    retry: 0,
    startTime: new Date(),
    steps: [],
    ...overrides,
  } as TestResult
}

describe("Test2DocReporter", () => {
  let mockLogging: MockInstance<(...args: unknown[]) => boolean>
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    // Mock print to terminal
    mockLogging = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    // Clean up the temporary directory
    testCleanup()
    mockLogging.mockRestore()
  })

  // TODO: remove this later
  describe("withDocMeta", () => {
    it("loading the reporter file should enable the withDocMeta JSON stringify for Docusaurus Page Header Data", () => {
      expect(withDocMeta("test title", { title: "Test" })).toBe(
        'test title[test2doc_page]:{"title":"Test"}',
      )
    })
  })

  it("should generate markdown for each root describe block in a file", () => {
    const reporter = setup()
    let bufferCounter = 0
    const createMockScreenshotBuffer = () =>
      Buffer.from(`mock image data ${bufferCounter++}`)
    writeFileSync(
      join(tempDir, "test2doc-1704067218000-1.png"),
      createMockScreenshotBuffer(),
    )
    writeFileSync(join(tempDir, "test2doc-old.md"), "# Old Documentation")
    mkdirSync(join(tempDir, "test2doc-old-dir"))
    mkdirSync(join(tempDir, "test2doc-old-category-dir"))
    writeFileSync(
      join(tempDir, "test2doc-old-category-dir/_category_.json"),
      JSON.stringify(
        {
          label: "This needs to be cleaned up",
          position: 1,
        },
        null,
        2,
      ),
    )

    reporter.onBegin(mockFullConfig, mockSuiteForPages)
    reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStep)
    const mockScreenshotName1 = `test2doc-${Date.now() + 500}-1.png`
    const mockScreenshotName2 = `test2doc-${Date.now() + 999}-2.png`
    const mockScreenshotName3WithAltText = `test2doc-${Date.now() + 1001}-3.png:Alt Text`
    const mockScreenshotName4 = `test2doc-${Date.now() + 1101}-4.png`
    const mockScreenshotName5 = `test2doc-${Date.now() + 1201}-5.png`
    const buffer1 = createMockScreenshotBuffer()
    const buffer2 = createMockScreenshotBuffer()
    const buffer3 = createMockScreenshotBuffer()
    const buffer4 = createMockScreenshotBuffer()
    const buffer5 = createMockScreenshotBuffer()
    const mockAttachmentSuccess = [
      {
        name: mockScreenshotName1,
        body: buffer1,
        contentType: "image/png",
      },
    ]
    const mockAttachmentFail = [
      ...mockAttachmentSuccess,
      {
        name: mockScreenshotName2,
        body: buffer2,
        contentType: "image/png",
      },
      {
        name: mockScreenshotName3WithAltText,
        body: buffer3,
        contentType: "image/png",
      },
    ]
    const mockAttachmentPrivacyPolicyLogin = [
      ...mockAttachmentFail,
      {
        name: mockScreenshotName4,
        body: buffer4,
        contentType: "image/png",
      },
    ]
    const mockAttachmentPrivacyPolicyRegistration = [
      ...mockAttachmentPrivacyPolicyLogin,
      {
        name: mockScreenshotName5,
        body: buffer5,
        contentType: "image/png",
      },
    ]
    vi.advanceTimersByTime(600)

    reporter.onStepEnd(
      mockTestSuccess,
      createMockTestResult({ attachments: mockAttachmentSuccess }),
      mockStep,
    )

    reporter.onTestEnd(mockTestSuccess, createMockTestResult())

    vi.advanceTimersByTime(400)

    reporter.onStepBegin(mockTestFail, createMockTestResult(), mockStep)
    reporter.onStepEnd(
      mockTestFail,
      createMockTestResult({ attachments: mockAttachmentSuccess }),
      mockStep,
    )
    reporter.onTestEnd(mockTestFail, createMockTestResult())
    vi.advanceTimersByTime(100)
    reporter.onStepEnd(
      mockTestFail,
      createMockTestResult({ attachments: mockAttachmentFail }),
      mockStep,
    )

    reporter.onStepBegin(
      mockTestPrivacyPolicyLogin,
      createMockTestResult(),
      mockStep,
    )
    vi.advanceTimersByTime(100)
    reporter.onStepEnd(
      mockTestPrivacyPolicyLogin,
      createMockTestResult({ attachments: mockAttachmentPrivacyPolicyLogin }),
      mockStep,
    )
    reporter.onTestEnd(mockTestPrivacyPolicyLogin, createMockTestResult())

    reporter.onTestEnd(mockTestNewUserRegistration, createMockTestResult())

    reporter.onStepBegin(
      mockTestPrivacyPolicyRegistration,
      createMockTestResult(),
      mockStep,
    )
    vi.advanceTimersByTime(100)
    reporter.onStepEnd(
      mockTestPrivacyPolicyRegistration,
      createMockTestResult({
        attachments: mockAttachmentPrivacyPolicyRegistration,
      }),
      mockStep,
    )

    reporter.onTestEnd(
      mockTestPrivacyPolicyRegistration,
      createMockTestResult(),
    )
    reporter.onTestEnd(mockTestLoggedInUser, createMockTestResult())
    reporter.onTestEnd(mockTestLoggedOutUser, createMockTestResult())

    expect(readdirSync(tempDir)).toHaveLength(4)
    reporter.onEnd()

    expect(readdirSync(tempDir)).toHaveLength(8)
    expect(
      readFileSync(`${tempDir}/test2doc-registration-page.mdx`, "utf8"),
    ).toEqual(
      `---
title: Registration Page Documentation
description: The registration page for new users.
sidebar_position: 1
---

# Registration Page

## New User Registration

### should register a new user successfully

## link to privacy policy

### should open privacy policy in new tab

Given user is on login page
![screenshot](./test2doc-0d5626c46ad3.png)

`,
    )
    expect(readFileSync(`${tempDir}/test2doc-login-page.mdx`, "utf8")).toEqual(
      `---
title: Login Page Documentation
keywords:
  - login
  - password
  - username
description: The different login scenarios for the login page.
sidebar_position: 1
parse_number_prefixes: true
---

# Login Page

## Successful Login

### should redirect to dashboard on successful login

Given user is on login page
![screenshot](./test2doc-fc6a5aa2918b.png)

## Failed Login

### should display error message on failed login

Given user is on login page
![screenshot](./test2doc-be826aa977e6.png)
![Alt Text](./test2doc-df78fdc04e9c.png)

## link to privacy policy

### should open privacy policy in new tab

Given user is on login page
![screenshot](./test2doc-89d4efdc31b3.png)

`,
    )
    expect(
      readFileSync(`${tempDir}/test2doc-dashboard-page.mdx`, "utf8"),
    ).toEqual(
      `---
title: Dashboard Documentation
description: The dashboard of todo stuff.
sidebar_position: 2
---

# Dashboard Page

## Logged In User

### should display a list of todos

## Logged Out User

### should redirect to login page

`,
    )
    expect(readFileSync(`${tempDir}/test2doc-fc6a5aa2918b.png`)).toEqual(
      buffer1,
    )
    expect(readFileSync(`${tempDir}/test2doc-be826aa977e6.png`)).toEqual(
      buffer2,
    )
    expect(readFileSync(`${tempDir}/test2doc-df78fdc04e9c.png`)).toEqual(
      buffer3,
    )
    expect(readFileSync(`${tempDir}/test2doc-89d4efdc31b3.png`)).toEqual(
      buffer4,
    )
    expect(readFileSync(`${tempDir}/test2doc-0d5626c46ad3.png`)).toEqual(
      buffer5,
    )

    // Logging expectations
    expect(mockLogging).toHaveBeenCalledWith(
      "Starting documentation generation for 7 tests...\n",
    )
    expect(mockLogging).toHaveBeenCalledWith(
      "Found 3 documentation sections\n\n",
    )

    // Progress bar updates
    expect(mockLogging).toHaveBeenCalledWith("\r\x1b[K") // Clear line
    expect(mockLogging).toHaveBeenCalledWith("[.......] 0/7 (0%)")
    expect(mockLogging).toHaveBeenCalledWith("[P......] 1/7 (14%)")
    expect(mockLogging).toHaveBeenCalledWith("[PP.....] 2/7 (29%)")
    expect(mockLogging).toHaveBeenCalledWith("[PPP....] 3/7 (43%)")
    expect(mockLogging).toHaveBeenCalledWith("[PPPP...] 4/7 (57%)")
    expect(mockLogging).toHaveBeenCalledWith("[PPPPP..] 5/7 (71%)")
    expect(mockLogging).toHaveBeenCalledWith("[PPPPPP.] 6/7 (86%)")
    expect(mockLogging).toHaveBeenCalledWith("[PPPPPPP] 7/7 (100%)")

    expect(mockLogging).toHaveBeenCalledWith("\n\n")
    expect(mockLogging).toHaveBeenCalledWith(
      "Cleaning up old generated files...\n",
    )
    expect(mockLogging).toHaveBeenCalledWith(
      "Generating documentation files...\n",
    )
    expect(mockLogging).toHaveBeenCalledWith(
      "Documentation generation completed.\n",
    )
    expect(mockLogging).toHaveBeenCalledWith(`Output directory: ${tempDir}\n`)
    expect(mockLogging).toHaveBeenCalledWith("Processed 5 screenshots\n")
  })

  it("should generate a directory and a _category_.json, and a page for each describe block child under the category describe", () => {
    const reporter = setup()

    reporter.onBegin(mockFullConfig, mockSuiteForCategories)
    reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStep)
    reporter.onStepBegin(mockTestFail, createMockTestResult(), mockStep)
    reporter.onEnd()

    expect(
      readFileSync(`${tempDir}/test2doc-login-page/_category_.json`, "utf8"),
    ).toEqual(
      JSON.stringify(
        {
          label: "Login Page Documentation Label",
          position: 1,
          className: "login-page",
          link: {
            type: "generated-index",
            title: "Login Page Documentation Title",
            description: "The different login scenarios for the login page.",
            slug: "login-page",
          },
        },
        null,
        2,
      ),
    )
    expect(
      readFileSync(
        `${tempDir}/test2doc-login-page/test2doc-successful-login.mdx`,
        "utf8",
      ),
    ).toEqual(
      `---
sidebar_position: 1
---

# Successful Login

## should redirect to dashboard on successful login

Given user is on login page

`,
    )
    expect(readdirSync(`${tempDir}/test2doc-login-page`)).toHaveLength(3)
    expect(
      readFileSync(
        `${tempDir}/test2doc-login-page/test2doc-failed-login.mdx`,
        "utf8",
      ),
    ).toEqual(
      `# Failed Login

## should display error message on failed login

Given user is on login page

`,
    )
  })

  it("should generate markdown if there is no root describe block", () => {
    const reporter = setup()
    const mockSuiteWithoutRootDescribe: Suite = {
      ...baseSuite,
      title: "", // Root Suite
      type: "root",
      suites: [
        {
          ...baseSuite,
          title: "chromium", // or firefox, webkit, etc.
          type: "project",
          suites: [
            {
              ...baseSuite,
              title: "login.test.ts", // Test file name
              type: "file",
              suites: [],
              tests: [mockTestSuccess, mockTestFail],
            },
          ],
        },
      ],
    }

    reporter.onBegin(mockFullConfig, mockSuiteWithoutRootDescribe)
    reporter.onEnd()

    expect(readFileSync(`${tempDir}/test2doc-login.mdx`, "utf8")).toEqual(
      `# login

## should redirect to dashboard on successful login

## should display error message on failed login

`,
    )
  })

  describe("injectMarkdown", () => {
    it("should add markdown content inside a step", () => {
      const reporter = setup()
      const screenshotBuffer = Buffer.from("mock image data")

      reporter.onBegin(mockFullConfig, mockSuiteForPages)
      reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStep)

      const mockAttachments = [
        {
          name: `test2doc-markdown-${Date.now() + 100}-1.md`,
          body: Buffer.from("This is injected markdown content 1"),
          contentType: "text/markdown",
        },
        {
          name: `test2doc-${Date.now() + 500}-1.png`,
          body: screenshotBuffer,
          contentType: "image/png",
        },
        {
          name: `test2doc-markdown-${Date.now() + 550}-2.md`,
          body: Buffer.from("This is injected markdown content 2"),
          contentType: "text/markdown",
        },
      ]
      vi.advanceTimersByTime(600)

      reporter.onStepEnd(
        mockTestSuccess,
        createMockTestResult({ attachments: mockAttachments }),
        mockStep,
      )

      reporter.onTestEnd(mockTestSuccess, createMockTestResult())
      reporter.onEnd()

      expect(
        readFileSync(`${tempDir}/test2doc-login-page.mdx`, "utf8"),
      ).toEqual(
        `---
title: Login Page Documentation
keywords:
  - login
  - password
  - username
description: The different login scenarios for the login page.
sidebar_position: 1
parse_number_prefixes: true
---

# Login Page

## Successful Login

### should redirect to dashboard on successful login

Given user is on login page

This is injected markdown content 1

![screenshot](./test2doc-15208f4337a8.png)

This is injected markdown content 2


## Failed Login

### should display error message on failed login

## link to privacy policy

### should open privacy policy in new tab

`,
      )
      expect(readFileSync(`${tempDir}/test2doc-15208f4337a8.png`)).toEqual(
        screenshotBuffer,
      )
    })
  })

  describe("exit test run", () => {
    let mockExit: MockInstance<
      (code?: string | number | null | undefined) => never
    >

    beforeEach(() => {
      mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called")
      })
    })

    afterEach(() => {
      mockExit.mockRestore()
    })

    it("when there are failed tests", () => {
      const reporter = setup()

      const mockFailedResult = createMockTestResult({ status: "failed" })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(
        `\n\nDocumentation generation aborted due to test failure: ${mockTestSuccess.title}\n`,
      )
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(mockExit).toHaveBeenCalledTimes(1)
    })

    it("when there are tests that timeout", () => {
      const reporter = setup()

      const mockTimeoutResult = createMockTestResult({ status: "timedOut" })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockTimeoutResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(
        `\n\nDocumentation generation aborted due to test failure: ${mockTestSuccess.title}\n`,
      )
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(mockExit).toHaveBeenCalledTimes(1)
    })

    it("when there are failed tests but the command flag to ignore is set, we run tests anyway.", () => {
      process.env.IGNORE_TEST_FAILURES = "true"
      const reporter = setup()

      const mockFailedResult = createMockTestResult({ status: "failed" })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).not.toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(
        `\n\nDocumentation generation aborted due to test failure: ${mockTestSuccess.title}\n`,
      )

      expect(mockExit).toHaveBeenCalledTimes(0)
      delete process.env.IGNORE_TEST_FAILURES
    })

    it("when a failed test has an error with a stack trace, it should output the stack", () => {
      const reporter = setup()
      const mockError = {
        message: "Expected 'foo' to equal 'bar'",
        stack:
          "Error: Expected 'foo' to equal 'bar'\n    at Object.<anonymous> (src/foo.test.ts:42:5)",
      }
      const mockFailedResult = createMockTestResult({
        status: "failed",
        errors: [mockError],
      })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(`${mockError.stack}\n`)
    })

    it("when a failed test has an error without a stack, it should output the message", () => {
      const reporter = setup()
      const mockError = { message: "Something went wrong" }
      const mockFailedResult = createMockTestResult({
        status: "failed",
        errors: [mockError],
      })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(`${mockError.message}\n`)
    })

    it("when a failed test throws a non-Error value, it should output the value", () => {
      const reporter = setup()
      const mockError = { value: "something string-like was thrown" }
      const mockFailedResult = createMockTestResult({
        status: "failed",
        errors: [mockError],
      })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(`${mockError.value}\n`)
    })

    it("when a failed test has stderr output, it should output each line", () => {
      const reporter = setup()
      const mockFailedResult = createMockTestResult({
        status: "failed",
        stderr: [
          "error from page: network request failed\n",
          "another error\n",
        ],
      })

      expect(() =>
        reporter.onTestEnd(mockTestSuccess, mockFailedResult),
      ).toThrow("process.exit called")

      expect(mockLogging).toHaveBeenCalledWith(
        "error from page: network request failed\n\n",
      )
      expect(mockLogging).toHaveBeenCalledWith("another error\n\n")
    })
  })

  it("should generate documentation for each project (except for .setup.ts files)", () => {
    const reporter = setup()

    reporter.onBegin(mockFullConfig, mockSuiteWithMultiProjects)
    reporter.onEnd()

    expect(readdirSync(tempDir)).toHaveLength(2)

    expect(readFileSync(`${tempDir}/test2doc-login.mdx`, "utf8")).toEqual(
      `# login

## how to login

## how to logout

`,
    )

    expect(
      readFileSync(`${tempDir}/test2doc-authenticated.mdx`, "utf8"),
    ).toEqual(`# authenticated

## user name and profile should be visible

## setting button should set

`)

    // Progress bar should count the setup file
    expect(mockLogging).toHaveBeenCalledWith("[........] 0/8 (0%)")
  })

  it("progress bar should count setup files towards total tests", () => {
    const reporter = setup()

    reporter.onBegin(mockFullConfig, mockSingleSetupFileSuite)
    reporter.onTestEnd(mockSetupTest, createMockTestResult())
    reporter.onTestEnd(mockAuthenticatedTest, createMockTestResult())
    reporter.onEnd()

    expect(mockLogging).toHaveBeenCalledWith("[..] 0/2 (0%)")
    expect(mockLogging).toHaveBeenCalledWith("[P.] 1/2 (50%)")
    expect(mockLogging).toHaveBeenCalledWith("[PP] 2/2 (100%)")
  })

  describe("progress bar scaling to terminal width", () => {
    let originalColumns: number | undefined

    beforeEach(() => {
      originalColumns = process.stdout.columns
    })

    afterEach(() => {
      Object.defineProperty(process.stdout, "columns", {
        value: originalColumns,
        configurable: true,
      })
    })

    it("collapses the bar into fewer slots than tests when the terminal is too narrow", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 15,
        configurable: true,
      })
      const reporter = setup()
      const passedResult = createMockTestResult({ status: "passed" })

      for (let i = 0; i < 10; i++) {
        reporter.onTestEnd(mockTestSuccess, passedResult)
      }

      // 10 one-char slots would need "[PPPPPPPPPP] 10/10 (100%)" (25 chars),
      // which doesn't fit in a 15-column terminal, so it collapses to 1 slot
      expect(mockLogging).toHaveBeenCalledWith("[P] 10/10 (100%)")
    })

    it("shows the worst status when multiple tests are collapsed into one slot", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 15,
        configurable: true,
      })
      process.env.IGNORE_TEST_FAILURES = "true"
      const reporter = setup()
      const passedResult = createMockTestResult({ status: "passed" })
      const failedResult = createMockTestResult({ status: "failed" })

      reporter.onTestEnd(mockTestSuccess, failedResult)
      for (let i = 0; i < 9; i++) {
        reporter.onTestEnd(mockTestSuccess, passedResult)
      }

      expect(mockLogging).toHaveBeenCalledWith("[F] 10/10 (100%)")
      delete process.env.IGNORE_TEST_FAILURES
    })

    it("still shows one character per test when everything fits in the terminal", () => {
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      })
      const reporter = setup()
      const passedResult = createMockTestResult({ status: "passed" })

      for (let i = 0; i < 5; i++) {
        reporter.onTestEnd(mockTestSuccess, passedResult)
      }

      expect(mockLogging).toHaveBeenCalledWith("[PPPPP] 5/5 (100%)")
    })
  })

  it("should not clean up user directories with generated files", () => {
    const reporter = setup()
    writeFileSync(join(tempDir, "test2doc-old.md"), "# Old Documentation")
    mkdirSync(join(tempDir, "test2doc-clean-me-up-dir"))
    mkdirSync(join(tempDir, "test2doc-login-page"))
    mkdirSync(join(tempDir, "test2doc-orphan-dir"))

    writeFileSync(
      join(tempDir, "test2doc-login-page/_category_.json"),
      JSON.stringify(
        {
          label: "This needs to be cleaned up",
          position: 1,
        },
        null,
        2,
      ),
    )
    const handWrittenContent =
      "# Hand-Written Documentation\n\nThis is some hand-written documentation for the login feature."
    writeFileSync(
      join(tempDir, "test2doc-login-page/hand-written-file.md"),
      handWrittenContent,
    )
    const anotherHandWrittenContent =
      "# Another Hand-Written Documentation\n\nThis is some hand-written documentation for the category feature."
    writeFileSync(
      join(tempDir, "test2doc-orphan-dir/another-hand-written-file.md"),
      anotherHandWrittenContent,
    )

    reporter.onBegin(mockFullConfig, mockSuiteForCategories)

    expect(readdirSync(tempDir)).toHaveLength(4)
    reporter.onEnd()

    expect(readdirSync(tempDir)).toHaveLength(2)
    expect(readdirSync(join(tempDir, "test2doc-login-page"))).toHaveLength(4)
    expect(
      readFileSync(
        join(tempDir, "test2doc-login-page/hand-written-file.md"),
        "utf8",
      ),
    ).toBe(handWrittenContent)
    expect(readdirSync(join(tempDir, "test2doc-orphan-dir"))).toHaveLength(1)
    expect(
      readFileSync(
        join(tempDir, "test2doc-orphan-dir/another-hand-written-file.md"),
        "utf8",
      ),
    ).toBe(anotherHandWrittenContent)
  })

  it("should generate figure and figcaption HTML for screenshots with figure metadata", () => {
    const reporter = setup()
    let bufferCounter = 0
    const createMockScreenshotBuffer = () =>
      Buffer.from(`mock image data ${bufferCounter++}`)

    reporter.onBegin(mockFullConfig, mockSuiteForPages)
    reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStep)

    const mockScreenshotName1 = `test2doc-${Date.now() + 500}-1.png`
    const mockScreenshotName2WithFigure = `test2doc-${Date.now() + 600}-2.png[test2doc_screenshot]:${JSON.stringify({ figure: true, caption: "User login screen" })}`
    const mockScreenshotName3FigureNoCaption = `test2doc-${Date.now() + 700}-3.png[test2doc_screenshot]:${JSON.stringify({ figure: true })}`
    const buffer1 = createMockScreenshotBuffer()
    const buffer2 = createMockScreenshotBuffer()
    const buffer3 = createMockScreenshotBuffer()

    const mockAttachmentWithFigure = [
      {
        name: mockScreenshotName1,
        body: buffer1,
        contentType: "image/png",
      },
      {
        name: mockScreenshotName2WithFigure,
        body: buffer2,
        contentType: "image/png",
      },
      {
        name: mockScreenshotName3FigureNoCaption,
        body: buffer3,
        contentType: "image/png",
      },
    ]

    vi.advanceTimersByTime(800)

    reporter.onStepEnd(
      mockTestSuccess,
      createMockTestResult({ attachments: mockAttachmentWithFigure }),
      mockStep,
    )

    reporter.onTestEnd(mockTestSuccess, createMockTestResult())
    reporter.onEnd()

    const content = readFileSync(`${tempDir}/test2doc-login-page.mdx`, "utf8")

    // Regular screenshot without figure should still work with standard markdown
    expect(content).toContain("![screenshot](./test2doc-b67cfe621cc5.png)")

    // Screenshot with figure and caption should include figcaption
    expect(content).toContain(
      `<figure>

![User login screen](./test2doc-fc6a5aa2918b.png)
<figcaption>User login screen</figcaption>
</figure>`,
    )

    // Screenshot with figure but no caption should not include figcaption
    expect(content).toContain(
      `<figure>

![screenshot](./test2doc-be826aa977e6.png)
</figure>`,
    )
  })

  it("should use a fixed filename for screenshots with filename metadata", () => {
    const reporter = setup()

    reporter.onBegin(mockFullConfig, mockSuiteForPages)
    reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStep)

    const attachments = [
      {
        name: `test2doc-${Date.now() + 500}-1.png[test2doc_screenshot]:${JSON.stringify({ caption: "Login button", filename: "login-button.png" })}`,
        body: Buffer.from("mock image data 1"),
        contentType: "image/png",
      },
      {
        name: `test2doc-${Date.now() + 600}-2.png[test2doc_screenshot]:${JSON.stringify({ figure: true, caption: "Login", filename: "login.png" })}`,
        body: Buffer.from("mock image data 2"),
        contentType: "image/png",
      },
      {
        name: `test2doc-${Date.now() + 700}-3.png[test2doc_screenshot]:${JSON.stringify({ filename: "../escape.png" })}`,
        body: Buffer.from("mock image data 3"),
        contentType: "image/png",
      },
    ]

    vi.advanceTimersByTime(800)

    reporter.onStepEnd(
      mockTestSuccess,
      createMockTestResult({ attachments }),
      mockStep,
    )

    reporter.onTestEnd(mockTestSuccess, createMockTestResult())
    reporter.onEnd()

    const content = readFileSync(`${tempDir}/test2doc-login-page.mdx`, "utf8")

    expect(content).toContain("![Login button](./login-button.png)")
    expect(content).toContain("![Login](./login.png)")
    expect(readFileSync(join(tempDir, "login-button.png"), "utf8")).toBe(
      "mock image data 1",
    )
    expect(readFileSync(join(tempDir, "login.png"), "utf8")).toBe(
      "mock image data 2",
    )

    // A path in the filename can't write outside the output directory
    expect(content).toContain("![screenshot](./escape.png)")
    expect(readFileSync(join(tempDir, "escape.png"), "utf8")).toBe(
      "mock image data 3",
    )
  })

  it("should skip steps with [nodoc] prefix from documentation", () => {
    const reporter = setup()

    reporter.onBegin(mockFullConfig, mockSuiteForPages)

    // Step with [nodoc] prefix
    const mockStepNodoc = {
      ...mockStep,
      title: "[nodoc] Setup test data",
    }
    reporter.onStepBegin(mockTestSuccess, createMockTestResult(), mockStepNodoc)
    reporter.onStepEnd(mockTestSuccess, createMockTestResult(), mockStepNodoc)

    // Regular step
    const mockStepRegular = {
      ...mockStep,
      title: "Given user is on login page",
    }
    reporter.onStepBegin(
      mockTestSuccess,
      createMockTestResult(),
      mockStepRegular,
    )
    reporter.onStepEnd(mockTestSuccess, createMockTestResult(), mockStepRegular)

    reporter.onTestEnd(mockTestSuccess, createMockTestResult())
    reporter.onEnd()

    const content = readFileSync(`${tempDir}/test2doc-login-page.mdx`, "utf8")

    // Regular step should be in the output
    expect(content).toContain("Given user is on login page")

    // [nodoc] step should NOT be in the output
    expect(content).not.toContain("Setup test data")
    expect(content).not.toContain("[nodoc]")
  })
})
