The Test2Doc is a project that generates documentation based on tests, helping you keep your technical documentation automatically in sync with your code.

# Test2Doc Playwright Reporter
The `@test2doc/playwright` package is a [Playwright](https://playwright.dev/) reporter that generates documentation in markdown. It generates markdown files compatible with [Docusaurus](https://docusaurus.io/).

## Installation & Setup

### Prerequisites

#### Playwright
If you don't have Playwright currently installed, you can follow [Playwright's installation guide](https://playwright.dev/docs/intro#installing-playwright). (Don't forget to run `npx playwright install` to install browsers after Playwright itself!)

#### Docusaurus
This reporter generates markdown files for Docusaurus. If you don't have a Docusaurus app set up yet, there is an install guide [here](https://docusaurus.io/docs/installation). If you have a monorepo, I recommend using these [instructions](https://docusaurus.io/docs/installation#monorepos).

Alternatively, you can install the Docusaurus app within your current repo with:

```sh
npx create-docusaurus@latest doc classic --typescript
```

This will make a `doc` directory with your Docusaurus app.

### Install the Reporter
After installing Playwright, you can add the `@test2doc/playwright` with your package manager of choice:

```sh
# npm
npm install @test2doc/playwright -D
# yarn
yarn add @test2doc/playwright --dev
# pnpm
pnpm install @test2doc/playwright -D
```

#### Configure Playwright to work with Test2Doc's Reporter
Create a new config to run Test2Doc: `playwright-test2doc.config.ts`

```ts
// playwright-test2doc.config.ts
import { defineConfig, devices } from "@playwright/test"

/**
 * Test2Doc Playwright Configuration
 * This config is optimized for generating documentation from your tests.
 */
export default defineConfig({
  // Test directory - adjust to match your project structure
  testDir: './tests',

  // Test2Doc Reporter Configuration
  reporter: [
    ['@test2doc/playwright', { 
      outputDir: './doc/docs'  // Change this to your Docusaurus docs directory
    }]
  ],

  // Optimized settings for doc generation
  fullyParallel: false,
  workers: 1,  // Single worker for consistent output
  retries: 0,  // No retries needed for doc generation

  // Use only one browser for faster doc generation
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  use: {
    baseURL: "http://localhost:5173", // change to whatever port your app starts on
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev", // change with command to start your server
    url: "http://localhost:5173", // change to whatever port your app starts on
    reuseExistingServer: !process.env.CI,
  },

  // Optional: Import settings from your main config
  // Uncomment and adjust the path if you want to inherit from your main config
  // ...require('./playwright.config').default,
});
```

Replace `"./doc/docs"` with a path to the `doc` directory of your Docusaurus app.

##### Add script to run Playwright to generate docs

Also add a script to build the docs in your project's `package.json`.

The `TEST2DOC=true` is required to activate the test2doc metadata to pass to the tests in a headless context. For normal test runs, you probably don't want the extra noise of the metadata, so leave this out of your standard test run.

```json
{
  ...
  "scripts": {
    ...
    "doc:gen": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts"
  }
  ...
}
```

## Verify installation
To verify your setup works, run `npm run doc:gen` and check that markdown files appear in your `./doc/docs` directory, or wherever you specified the output directory in the `playwright-test2doc.config.ts` file.

## Filtering Tests
It is possible you may wish to opt-in some tests or opt-out other tests from doc generation. This is possible with playwright tags.

### Tag tests
Adding tags to playwright tests is easy. See the [official docs](https://playwright.dev/docs/test-annotations#tag-tests) for more details. 

There are a few different approaches to tagging, but for this README we're going with passing in a tag array to help support multiple tags. But if you prefer one of the other options playwright supports, feel free to use it.

```ts
// Add tag to describe block level
test.describe('Describe Block', {
  tag: ['@test2doc']
}, () => {
  test('this test inherits from the describe block', () => {
    ...
  })
})

// Add tag to tests
// This example has multiple tags
test('test title', {
  tag: ['@test2doc', '@other-tag'],
}, async ({ page }) => {
  ...
});

// Add tag to skip doc generation
test('test will skip doc generation', {
  tag: ['@skip-docs'],
}, async ({ page }) => {
  ...
});
```

### Opt-in Approach
**Best for:** Legacy codebases or when you want explicit control over which tests generate documentation.

Run only tests with the `@test2doc` tag.

#### Update package.json
```json
{
  ...
  "scripts": {
    ...
    "doc:gen": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts --grep @test2doc"
  }
  ...
}
```

### Opt-out Approach
**Best for:** Tests that don't need documentation generated, like flaky tests or internal API tests.

Skip tests with the `@skip-docs` tag.

#### Update package.json
```json
{
  ...
  "scripts": {
    ...
    "doc:gen": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts --grep-invert @skip-docs"
  }
  ...
}
```

## How it works

After this setup, every time you run your Playwright tests, the `@test2doc/playwright` reporter will automatically generate a new markdown file in your specified Docusaurus docs directory for each test file and/or top-level describe block found in your Playwright test files.

> **Note:** Any test files with a `.setup.ts` (or `.setup.js`) extension are automatically ignored and will not generate documentation. This is to prevent Playwright global setup/auth files from appearing in your docs.

### Cleanup Step
The cleanup step is designed to maintain a tidy output directory by removing outdated files and directories created by the Test2Doc reporter.

The cleanup step runs after all the successful test have ran and just before generating the documentation.

#### What Happens During Cleanup
- **File Deletion**: Any files prefixed with `test2doc-` (e.g., `test2doc-login.md`) will be deleted from the output directory. This ensures that only the most recent documentation files are retained.
- **Directory Management**: Directories that contain files not generated by the Test2Doc reporter will not be deleted. This prevents the loss of any handwritten documentation or other important files.

**Note** It is safe to place your handwritten files in directories generated by Test2Doc. However, be mindful that if you clean up tests associated with that directory and put handwritten files into it, that the directory may become an orphan and only contain the handwritten files.

### Adding Docusaurus Page Metadata
Docusaurus supports [markdown front matter](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter) to allow for more control of pages and to help position links in the sidebar.

To add this metadata to the test2doc markdown files that are generated, use the `withDocMeta` function in your describe blocks in your test.

```ts
import { withDocMeta } from "@test2doc/playwright/DocMeta";

...

describe(withDocMeta("Title of Page", {
  title: "Title in Sidebar",
  sidebar_position: 1,
  ...
  }), () => {
    test("test block", () => {
      ...
    })
  })
```

### Adding Docusaurus Category Routes
Docusaurus supports grouping docs by [category](https://docusaurus.io/docs/sidebar/autogenerated#category-item-metadata).

By using the `withDocCategory` function for a describe block's title, this will add the metadata to allow Test2Doc to generate a new directory and a `_category_.json` file. It will then place all subsequent describes and tests under this new route.

```ts

import { withDocCategory, withDocMeta } from "@test2doc/playwright/DocMeta";

...

describe(withDocCategory("Title of Category Route", {
  label: "Category Sidebar Label",
  position: 1,
  className: "class-to-add-on-sidebar-label",
  ...
  }),
  () => {
    describe(withDocMeta("Title of Page in Category", {
      title: "Title in Sidebar under Category",
      sidebar_position: 1,
      ...
      }), () => {
        test("test block", () => {
          ...
        })
      })
  })
```

### Adding Screenshots
To add screenshots to your documentation use the `screenshot` helper function.

Screenshots will be added after the Step block's title and in the order they're generated.

```ts
import { screenshot } from "@test2doc/playwright/screenshots"
...

test.describe(withDocMeta("describe block"), async () => {
    test("test block", async ({ page }, testInfo) => {
      ...
      test.step("step block", async () => {
        await page.goto("http://localhost:5173/")
        await screenshot(testInfo, page)
      })
    })
  })
```

#### Highlight an element
It's possible to highlight an element by passing in a locator of an element on the page.

```ts
import { screenshot } from "@test2doc/playwright/screenshots"
...

test.describe(withDocMeta("describe block"), async () => {
    test("test block", async ({ page }, testInfo) => {
      ...
      test.step("step block", async () => {
        await page.goto("http://localhost:5173/")
        await screenshot(testInfo, page.getByRole("header", {name: "Page Title"}))
      })
    })
  })
```

##### Add a label while highlighting an element
In case the highlight is not enough, you can add a label under the highlighted element.

```ts
import { screenshot } from "@test2doc/playwright/screenshots"
...

test.describe(withDocMeta("describe block"), async () => {
    test("test block", async ({ page }, testInfo) => {
      ...
      test.step("step block", async () => {
        await page.goto("http://localhost:5173/")
        await screenshot(
          testInfo,
          page.getByRole("header", {name: "Page Title"},
          { annotation: { text: "Heading of the Page" } }
        ))
      })
    })
  })
```

##### Annotation Object Properties
To style the highlight and label we expose a few properties on the `annotation` object. They're named similar to the [Canvas 2D context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D), which is used to render the highlight and label.

- **`text`**:
  - **Type**: `string`
  - **Description**: The text to display for the label. This is the main content that will be rendered on the canvas. Use `\n` to start a new line.
  - **Default**: `""` (empty string)

- **`labelMaxWidth`**:
  - **Type**: `number`
  - **Description**: The maximum width of the label text in pixels. Longer text wraps onto new lines between words. A single word wider than this stays on one line.
  - **Default**: `undefined` (no wrapping)

- **`textAlign`**:
  - **Type**: `"left" | "center" | "right"`
  - **Description**: How lines of a multi-line label are aligned inside the label box.
  - **Default**: Aligned towards the highlighted element: `"right"` when the label is left of it, `"left"` when the label is right of it, otherwise `"center"`.

- **`filename`**:
  - **Type**: `string`
  - **Description**: A fixed file name for the screenshot in the generated docs, so every run writes the same file and overwrites the previous one. `.png` is added if missing. It can't contain `/` or `\`. Use a unique name per screenshot, since two screenshots with the same name overwrite each other. Don't set it in `annotationDefaults`, or every screenshot will share one file. Renamed or removed screenshots aren't cleaned up automatically.
  - **Default**: `undefined` (named from a hash of the image, e.g. `test2doc-3f2a9c1b7e4d.png`)

- **`fillStyle`**:
  - **Type**: `string`
  - **Description**: The color of the label text. Accepts any valid CSS color value, including hex codes, RGB, RGBA, HSL, or HSLA.
  - **Default**: `rgba(0, 0, 0, 1)` (black)

- **`font`**:
  - **Type**: `string`
  - **Description**: Specifies the font size, font-weight, and family for the label text. Follows the CSS font property syntax (e.g., `"16px Arial"`).
  - **Default**: `"14px Arial"`

- **`strokeStyle`**:
  - **Type**: `string`
  - **Description**: The color of the outline around the label text. Accepts any valid CSS color value.
  - **Default**: `rgba(0, 0, 0, 0.1)` (light black)

- **`lineWidth`**:
  - **Type**: `number`
  - **Description**: The thickness of the outline around the label text.
  - **Default**: `2`

- **`labelBoxFillStyle`**:
  - **Type**: `string`
  - **Description**: The fill color of the label box surrounding the annotation text. Accepts any valid CSS color value, including hex codes, RGB, RGBA, HSL, or HSLA.
  - **Default**: `rgba(0, 0, 0, 0)` (transparent)

- **`labelBoxStrokeStyle`**:
  - **Type**: `string`
  - **Description**: The border color of the label box. Similar to `labelBoxFillStyle`, this property accepts any valid CSS color value.
  - **Default**: `rgba(0, 0, 0, 0)` (transparent)

- **`labelBoxLineWidth`**:
  - **Type**: `number`
  - **Description**: The width of the border for the label box. This property determines how thick the outline of the label box will be.
  - **Default**: `2`

- **`labelBoxPadding`**:
  - **Type**: `number`
  - **Description**: The space in pixels between the label text and the edge of the label box, on all four sides.
  - **Default**: `4`

- **`highlightFillStyle`**:
  - **Type**: `string`
  - **Description**: The fill color of the highlight box. Accepts any valid CSS color value. **Make sure to add some transparency (`rgba()`, `hsla()`, or 8-digit hex format like `#FF000080`) else it will block the element entirely.**
  - **Default**: `rgba(255, 165, 0, 0.3)` (orange with 30% transparency)

- **`highlightStrokeStyle`**:
  - **Type**: `string`
  - **Description**: The border color of the highlight box. Accepts any valid CSS color value.
  - **Default**: `rgba(255, 165, 0, 1)` (solid orange)

- **`highlightLineWidth`**:
  - **Type**: `number`
  - **Description**: The width of the border for the highlight box.
  - **Default**: `2`

- **`position`**:
  - **Type**: `"above" | "below" | "left" | "right" | number`
  - **Description**: Determines the position of the label text relative to the highlighted element. Uses clock convention where 0° = top, 90° = right, etc. If a number is provided, it positions the label at that degree angle. Defaults to automatically positioning towards the screen center.
  - **Default**: Automatically positions label towards the center of the screen.
- **`showArrow`**:
  - **Type**: `boolean`
  - **Description**: Whether to display an arrow pointing from the label to the highlighted element. When enabled, creates a visual connection between the annotation text and the target element.
  - **Default**: `false`

- **`arrowStrokeStyle`**:
  - **Type**: `string`
  - **Description**: The color of the arrow line and arrowhead. Accepts any valid CSS color value, including hex codes, RGB, RGBA, HSL, or HSLA.
  - **Default**: `rgba(255, 0, 0, 1)` (red)

- **`arrowLineWidth`**:
  - **Type**: `number`
  - **Description**: The thickness of the arrow line. The arrowhead size automatically scales based on this value.
  - **Default**: `2`

```ts
test.describe(withDocMeta("describe block"), async () => {
    test("test block", async ({ page }, testInfo) => {
      ...
      test.step("step block", async () => {
        await page.goto("http://localhost:5173/")
        await screenshot(
          testInfo,
          page.getByRole("header", {name: "Page Title"},
          { annotation: {
            text: "Heading of the Page",
            fillStyle: "rgba(255, 255, 255, 1)",
            font: "bold 16px Helvetica",
            strokeStyle: "rgba(0, 0, 0, 0.5)",
            lineWidth: 4,
            labelBoxFillStyle: "rgba(0, 120, 120, 0.3)",
            labelBoxStrokeStyle: "rgba(0, 255, 0, 1)",
            labelBoxLineWidth: 2,
            highlightFillStyle: "rgba(255, 165, 0, 0.3)",
            highlightStrokeStyle: "#FFA500",
            highlightLineWidth: 2,
            position: "above",
            showArrow: true,
            arrowStrokeStyle: "rgba(255, 0, 0, 0.8)",
            arrowLineWidth: 3
          }}
        ))
      })
    })
  })
```

##### Configure Annotation Defaults
If you want to set default values for the annotation object you can do so in your `playwright-test2doc.config.ts`. Just set the `annotationDefaults` object in the `test2doc` playwright global options. These defaults will be applied to all screenshots, but can still be overridden on a per-screenshot basis.
```ts
import { defineConfig, ... } from "@playwright/test"
import "@test2doc/types" // Add this import to add test2doc to the global options

export default defineConfig({
  ...
  use: {
    ...
    test2doc: {
      annotationDefaults: {
        fillStyle: "white",
        labelBoxFillStyle: "rgba(0, 123, 255, 0.6)",
        font: "bold 16px Helvetica, Arial, sans-serif",
        highlightStrokeStyle: "rgba(0, 123, 255, 1)",
        highlightFillStyle: "rgba(0, 0, 0, 0)",
        highlightLineWidth: 3,
        showArrow: true,
        arrowStrokeStyle: "rgba(0, 123, 255, 1)",
      },
    },
    ...
  },
  ...
})
```

#### Highlight multiple elements
In the event that you need to highlight multiple elements, you can pass in an array with `MultiLocatorScreenshot` objects.

The `MultiLocatorScreenshot` has 2 keys, `target`, a Playwright Locator, and options, which is a combination of `PageScreenshotOptions` and Annotation options.

**Note:** Only the first item in the array will be attempted to scroll into view.

```ts
test.describe(withDocMeta("describe block"), async () => {
    test("test block", async ({ page }, testInfo) => {
      ...
      test.step("step block", async () => {
        await page.goto("http://localhost:5173/")

        await screenshot(
          testInfo,
          [
            { 
              target: page.getByRole(
                "header", { name: "Page Title" }
              ),
            },
            {
              target: page.getByRole(
                "aside", { name: "Sidebar" }
              ),
              options: {
                annotation: {
                  text: "Sidebar Element",
                  position: 270,
                  showArrow: true,
                  arrowStrokeStyle: "red",
                },
              },
            },
          ],
          {
            // Values applied to all annotations
            annotation: {
              font: "14px 'Times New Roman', Times, serif"
            },
          },
        )
    })
  })
```