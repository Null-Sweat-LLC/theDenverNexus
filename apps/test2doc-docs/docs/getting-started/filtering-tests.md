---

title: Filtering Tests
sidebar_position: 3
---

# Filtering Tests

Not all tests need to generate documentation. Filtering allows you to control which tests are included in the documentation process, making it easier to focus on the most relevant tests. You can use Playwright tags to opt-in specific tests or exclude tests that don’t need documentation.

## Tag tests

Adding tags to Playwright tests is easy. See the [official docs](https://playwright.dev/docs/test-annotations#tag-tests) for more details.

Tags are metadata you can attach to Playwright tests or describe blocks. They allow you to group tests or control their behavior. For Test2Doc, we recommend using tags like `@test2doc` to include tests in documentation and `@skip-docs` to exclude them. You can use any tagging convention that works for your project.

There are a few different approaches to tagging, but our recommendation is to use a tag array to help support multiple tags. But if you prefer one of the other approaches Playwright supports, feel free to use those instead.

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

## Opt-in Approach

**Best for:** Legacy codebases or when you want explicit control over which tests generate documentation.

Run only tests with the `@test2doc` tag.

### Update package.json

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

## Opt-out Approach

**Best for:** Tests that don't need documentation generated, like flaky tests or internal API tests.

Skip tests with the `@skip-docs` tag.

### Update package.json

```json
{
  ...
  "scripts": {
    ...
    "docs:generate": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts --grep-invert @skip-docs"
  }
  ...
}
```

## Troubleshooting

- **No tests are generating docs**: Ensure your `grep` or `grep-invert` pattern matches the tags in your tests.
- **Unexpected tests are included**: Double-check that your tags are applied correctly at the test or describe block level.
- **Playwright version compatibility**: Ensure you’re using a Playwright version that supports tagging ([v1.42.0+](https://playwright.dev/docs/release-notes#version-142)).

## See Also

To filter individual test steps from documentation, see the [`[nodoc]` prefix feature](../user-guide/test-steps.md#skipping-steps-with-nodoc).
