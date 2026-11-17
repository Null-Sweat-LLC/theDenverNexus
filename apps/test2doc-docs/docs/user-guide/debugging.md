---

title: Debugging Failing Doc Generation
sidebar_position: 6
---

Sometimes your tests might be passing, but failing when generating documentation. Here are some tips to help debug what is happening.

## Disabling exit on failure

To prevent doc generation from becoming corrupted, the default behavior is to exit the process if a test fails.

To disable this behavior you can set the `IGNORE_TEST_FAILURES` environment variable by adding `IGNORE_TEST_FAILURES=true` to your script command.

```json title="package.json" {6}
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "test": "playwright test --ui",
    "doc": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts",
    "doc:debug": "IGNORE_TEST_FAILURES=true TEST2DOC=true playwright test --config=playwright-test2doc.config.ts"
  },
```

## Run with Playwright UI

Adding the `--ui` flag to the script or passing it in on the command line will start up the Playwright test suite with the UI. This will allow for more information and a visual inspection of what the problem might be.

### Passing the flag from the command line

```sh
pnpm doc:debug --ui
```

### Adding the flag in the script commands

```json title="package.json" {6}
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "test": "playwright test --ui",
    "doc": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts",
    "doc:debug": "IGNORE_TEST_FAILURES=true TEST2DOC=true playwright test --config=playwright-test2doc.config.ts --ui"
  },
```

## Flaky tests

If a test is flaky (passes when running the test normally but fails often during doc generation), the most pragmatic solution is unfortunately to skip the test for doc generation and create a manual doc to capture that functionality.

To skip a test you can use Playwright's tagging feature and filter out the test by tags. See the [Filtering Tests guide](../getting-started/filtering-tests.md) for more details.

This should only be a temporary solution, as you should probably still investigate the root cause for the flakiness and resolve it.

## Read More

For more comprehensive debugging techniques, check out these official Playwright resources:

### Interactive Debugging

- [Debugging Tests](https://playwright.dev/docs/debug) - Using the inspector, debug mode, and step-through debugging
- [UI Mode](https://playwright.dev/docs/test-ui-mode) - Interactive testing with time-travel debugging
- [Running and Debugging Tests](https://playwright.dev/docs/running-tests) - CLI options, headed mode, and slow motion

### Visual Debugging

- [Trace Viewer](https://playwright.dev/docs/trace-viewer) - Recording and viewing detailed traces of test execution
- [Screenshots and Videos](https://playwright.dev/docs/screenshots) - Capturing visual artifacts on failure

### Common Issues

- [Test Timeouts](https://playwright.dev/docs/test-timeouts) - Configuring and understanding timeout errors
- [Test Isolation](https://playwright.dev/docs/browser-contexts) - Understanding test isolation with browser contexts
- [Locators](https://playwright.dev/docs/locators) - Best practices for reliable element selection

### Advanced

- [Network](https://playwright.dev/docs/network) - Inspecting network activity and requests
- [Test Reporters](https://playwright.dev/docs/test-reporters) - Understanding test output and logs
