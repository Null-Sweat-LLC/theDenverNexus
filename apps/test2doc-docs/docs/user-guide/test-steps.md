---

title: Test Steps
sidebar_position: 3
---

# Test Steps

Test2Doc automatically captures and documents test steps defined using Playwright's [`test.step()`](https://playwright.dev/docs/api/class-test#test-step) function. These steps appear as text entries in your generated documentation, helping readers understand the test flow.

## Basic Usage

Test steps are documented in the order they appear in your tests:

```ts
test("user login flow", async ({ page }) => {
  await test.step("Navigate to login page.\n", async () => {
    await page.goto("/login")
  })

  await test.step("Enter credentials ", async () => {
    await page
      .getByRole("textbox", { name: "Username" })
      .fill("user@example.com")
    await page.getByRole("textbox", { name: "Password" }).fill("password123")
  })

  await test.step("and click login button.\n", async () => {
    await page.getByRole("button", { name: "Login" }).click()
  })

  await test.step("Verify dashboard is displayed.", async () => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })
})
```

:::info Rendering Markdown quirk

Markdown renderers (like Docusaurus) combine consecutive text lines into a single paragraph. To force each test step to appear on its own line in the generated docs, add `\n` at the end of the step title string.

:::

This generates this markdown:

```md
## user login flow

Navigate to login page.

Enter credentials
and click login button.

Verify dashboard is displayed.
```

Which will generate html similar to this:

```html
<h2>user login flow</h2>
<p>Navigate to login page.</p>
<p>Enter credentials and click login button.</p>
<p>Verify dashboard is displayed.</p>
```

Notice how "Enter credentials" and "and click login button" are combined into one `<p>` tag because there was no `\n` between them.

## Skipping Steps with `[nodoc]`

Sometimes you need steps in your tests that shouldn't appear in documentation, such as test setup, data seeding, or cleanup operations. Use the `[nodoc]` prefix to skip these steps:

```ts
test("user can view their profile", async ({ page }) => {
  await test.step("[nodoc] Seed test user data", async () => {
    // Database seeding logic
    await seedDatabase({ user: testUser })
  })

  await test.step("[nodoc] Authenticate user", async () => {
    // Authentication setup
    await authenticateUser(page, testUser)
  })

  await test.step("Navigate to profile page", async () => {
    await page.goto("/profile")
  })

  await test.step("Verify user name is displayed", async () => {
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("John Doe")
  })

  await test.step("[nodoc] Clean up test data", async () => {
    // Database cleanup
    await cleanupDatabase()
  })
})
```

This generates documentation with only the relevant steps:

```md
## user can view their profile

Navigate to profile page
Verify user name is displayed
```

The `[nodoc]` steps are completely excluded from the generated documentation.

### When to Use `[nodoc]`

Use `[nodoc]` for:

- **Setup steps**: Database seeding, API configuration, or test data creation
- **Authentication**: Login flows that are prerequisites but not the focus of the test
- **Cleanup**: Teardown operations that restore state
- **Technical details**: Implementation details that aren't relevant to the user-facing documentation

### Best Practices

- Place `[nodoc]` at the beginning of the step title for clarity
- Keep documentation-worthy steps focused on user-visible actions
- Use descriptive names even for `[nodoc]` steps (they still appear in test output)
- Consider if a step is truly necessary for understanding the feature being documented

:::warning Avoid Screenshots in `[nodoc]` Steps

Do not capture screenshots within `[nodoc]` steps. While the step title will be excluded from documentation, any screenshots taken will still appear, creating orphaned images without context.

```ts
// ❌ Bad: Screenshot will appear without explanation
await test.step("[nodoc] Setup test data", async () => {
  await screenshot(testInfo, page) // This screenshot will still appear!
})

// ✅ Good: Keep screenshots in documented steps
await test.step("Verify initial state", async () => {
  await screenshot(testInfo, page)
})
```

If you need to take screenshots during setup for debugging purposes, those should be captured outside of the Test2Doc workflow using Playwrights native [screenshot functionality](https://playwright.dev/docs/screenshots).
:::

## Combining Steps with Screenshots

Steps work seamlessly with [screenshots](./screenshots/screenshots.md). When you capture a screenshot within a step, it appears in the documentation right after that step's title:

```ts
await test.step("Click submit button", async () => {
  const submitButton = page.getByRole("button", { name: "Submit" })
  await screenshot(testInfo, submitButton, {
    altText: "Submit button location",
  })
  await submitButton.click()
})
```

Generates:

```md
Click submit button
![Submit button location](./test2doc-abc123.png)
```
