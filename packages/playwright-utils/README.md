# @test2doc/playwright-utils

Playwright helpers for testing server-rendered React apps.

```bash
pnpm add -D @test2doc/playwright-utils
```

Requires `@playwright/test` 1.40+. No other dependencies.

## Hydration-safe interactions

A server-rendered button is visible and clickable before React hydrates and attaches its `onClick`. Playwright counts a click on it as a success even though nothing happened. Waiting for `networkidle` hides this most of the time but still flakes, because an idle network says nothing about whether hydration has finished. Retrying until the result appears is the only check that tells you the handler is attached.

### `clickUntil(trigger, expected, { timeout?, settle? })`

Clicks `trigger` until `expected` is visible. Retrying stops as soon as `expected` shows up, so a click that worked never gets a second one. That matters for toggles.

- `timeout` (default `15000`): the total time allowed before the click counts as a real failure.
- `settle` (default `2000`): how long each click gets to make `expected` appear before it counts as swallowed and is retried. Raise it for actions that are slow but must not happen twice, such as a form submit.

Before each click, `clickUntil` hovers with `force: true`. A plain `hover()` waits for the element to stop moving, so buttons with a CSS hover transform (`translateY` on `:hover`) send Playwright into an "element is not stable" retry loop.

```ts
await clickUntil(
  page.getByRole("button", { name: "Add shift" }),
  page.getByRole("dialog", { name: "New shift" }),
)
```

### `interactUntil(interact, assert, timeout = 15000)`

The general form of `clickUntil`, for interactions other than a single click. `interact` may run several times, so it must be safe to repeat.

```ts
await interactUntil(
  () => fillWithChange(page.getByLabel("Start time"), "2026-07-04T09:00"),
  () => expect(page.getByRole("alert", { name: "Overlap" })).toBeVisible(),
)
```

### `fillWithChange(locator, value)`

Use this instead of a bare `.fill()` inside `interactUntil`. React remembers the last value it saw in each input and skips `onChange` when an `input` event reports no change. If a fill before hydration set the field to `value`, filling the same `value` again never triggers `onChange`. Clearing the field first forces a real change on every attempt.

### `selectWithChange(locator, { label } | { value })`

The `<select>` version of `fillWithChange`. Uncontrolled selects (an `onChange` but no `value`) have one more trap: if an option was chosen before hydration, the DOM keeps showing it while React's state never updates, and nothing on screen tells you. Choosing the same option again does nothing. This helper switches to the first option before choosing the one you asked for.

## `RoleSelector`

The tuple type `page.getByRole` takes, for keeping selectors in one typed map:

```ts
export const selectors = {
  buttonSave: ["button", { name: "Save" }],
} satisfies Record<string, RoleSelector>

await page.getByRole(...selectors.buttonSave).click()
```

## `setTabVisibility(page, "visible" | "hidden")`

Overrides `document.visibilityState` and dispatches `visibilitychange`, for testing code that pauses, reconnects or refetches when the tab is hidden and shown again.

## Development

```bash
pnpm build
pnpm test
pnpm typecheck
```

## License

Apache-2.0
