---

title: Inject Markdown
sidebar_position: 5
---

# Inject Markdown

Test2Doc has a helper function to inject arbitrary markdown content into your documentation directly from your test steps.

Injected markdown appears as a paragraph in the generated documentation, rendered between other step content in the order it was called.

Injected markdown must be called inside a [`step`](https://playwright.dev/docs/api/class-test#test-step) block.

See the [Test Steps](./test-steps.md) guide for more details on using steps with Test2Doc.

## Imports

```ts
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"
```

## When to use injectMarkdown

- **Contextual explanation**: Add narrative text to clarify what a step is demonstrating
- **Callouts or warnings**: Draw attention to important behaviors in the documented flow
- **Links**: Include references to related documentation or external resources
- **Markdown formatting**: Use headings, lists, bold, or any markdown syntax to enrich your docs

## Example

```ts
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"
import { screenshot } from "@test2doc/playwright/screenshots"
...

test.describe(withDocMeta("describe block"), async () => {
  test("test block", async ({ page }, testInfo) => {
    await test.step("step block", async () => {
      await page.goto("https://example.com/login")
      await injectMarkdown(testInfo, "Enter your credentials to sign in.")
      await screenshot(testInfo, page)
    })
  })
})
```

### Example markdown

```md
# describe block

## test block

step block

Enter your credentials to sign in.

![screenshot](./test2doc-0d5626c46ad3.png)
```

## Troubleshooting

- **Markdown not appearing**: Ensure the `injectMarkdown` call is inside a `test.step` block
- **Content appears out of order**: Make sure to `await` both the `test.step` and `injectMarkdown` calls — order within a step follows call order
