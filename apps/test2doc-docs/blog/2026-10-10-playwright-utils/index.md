---
slug: playwright-utils
title: "Stop Waiting for networkidle: Introducing @test2doc/playwright-utils"
subtitle: "Playwright helpers for clicking, filling, and selecting in server-rendered React apps without the flakes"
authors: [dethstrobe]
tags: [testing]
---

Your test clicks a button. Playwright says the click worked. Nothing happens. The test fails, you rerun it, and it passes. Classic.

If your app is server-rendered React, the button was on the page and clickable before React hydrated and attached its `onClick`. Playwright clicked a button that didn't do anything yet. So I pulled the helpers I've been using to deal with this into a package: `@test2doc/playwright-utils`.
{/* truncate */}

## The problem with networkidle

The usual fix is `page.goto(url, { waitUntil: "networkidle" })`, and it mostly works. Mostly. An idle network tells you nothing about whether hydration has finished. On a slow CI runner, or a dev server compiling on demand, the network goes quiet for half a second and React still hasn't gotten around to your button.

It's also slow. `networkidle` only resolves once there have been no requests for 500ms, so every navigation spends at least half a second waiting on purpose before your test does anything. I measured it on [ScheduleLord](https://www.schedulelord.com/), the app these helpers came out of. Its login page finishes loading in 43ms. With `networkidle`, `page.goto` takes 564ms, thirteen times longer, and every page I tried paid an extra 520 to 620ms. Its test suite waited for `networkidle` on 37 page loads, so dropping them cut about 20 seconds of pure waiting from every run, counted across all its test workers.

Even [Playwright's own docs](https://playwright.dev/docs/api/class-page#page-goto) call `networkidle` discouraged.

And if your page long-polls, `networkidle` never arrives at all. The poll request stays open, so the wait sits there until it times out.

## What about a hydration flag?

The next idea is usually to have the app announce it. Set a flag once React is running, and wait for it in your tests:

```tsx
// in the app
useEffect(() => {
  document.body.dataset.hydrated = "true"
}, [])
```

```ts
// in the test
await page.waitForFunction(() => document.body.dataset.hydrated === "true")
```

It's tempting, but it's a code smell.

- **It's an implementation detail.** Hydration is how React gets your page running, not something your users ever see. A test that waits on it is testing how the app is built, not what it does. Switch frameworks, or change how the page renders, and every test depends on that flag being rebuilt, even though nothing a user does has changed.
- **It's test code in production.** Every user downloads and runs a flag that only your test suite reads.
- **It doesn't even promise what you want.** React hydrates in pieces. Content inside a `<Suspense>` boundary can hydrate after the root's effects have already run, so the flag says "hydrated" while the button you're about to click still isn't. And because it mostly works, it fails in exactly the same flaky way `networkidle` does.

The only check that tells you a handler is attached is the one your user does: click, and see if something happened. If it didn't, click again.

## clickUntil

```ts
import { clickUntil } from "@test2doc/playwright-utils"

await clickUntil(
  page.getByRole("button", { name: "Add shift" }),
  page.getByRole("dialog", { name: "New shift" }),
)
```

It clicks the button until the dialog shows up. Clicks that get swallowed before hydration are retried, and as soon as the dialog is visible it stops, so a click that worked never gets a second one. That matters for toggles, where a second click undoes the first.

For anything that isn't a single click, there's `interactUntil`, which repeats any interaction until an assertion passes:

```ts
import { fillWithChange, interactUntil } from "@test2doc/playwright-utils"

await interactUntil(
  () => fillWithChange(page.getByRole("textbox", { name: "Name" }), "Ada"),
  () => expect(page.getByRole("status")).toHaveText("Ada"),
)
```

## The sneaky ones: inputs and selects

That `fillWithChange` isn't decoration. React remembers the last value it saw in each input and skips `onChange` when nothing changed. So if a `fill()` before hydration already put "Ada" in the field, filling "Ada" again on the retry never fires `onChange`. Your retry loop keeps retrying until it times out. `fillWithChange` clears the field first, so every attempt is a real change.

Selects are worse. With an uncontrolled `<select>`, an option chosen before hydration keeps showing on the page while React's state never updates, and nothing on screen tells you. `selectWithChange` switches to the first option before choosing yours, so React actually sees a change.

## Your feedback is your assertion

Every helper waits on an assertion about what the interaction changed: a dialog opening, a status message updating. That's not just a testing trick. It's good accessibility. Every action should give the user feedback they can perceive, whether they're looking at the screen or listening to a screen reader (that's [WCAG 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)). If a click changes nothing a user can see or hear, they can't tell it worked, and neither can your test.

So assert on that feedback with `getByRole`, and your test also checks that the feedback exists. Two birds, one stone.

## Also in the box

- **`setTabVisibility`** fakes the user switching to another tab and coming back, for testing code that pauses polling, reconnects, or refetches when the tab is hidden. Playwright can't hide a tab for real. Every page stays `visible` even when you bring another one to the front, so you need to fake it.
- **`RoleSelector`** is the type behind the [selector tuple pattern](/blog/selector-tuple-vs-page-object-model), so you can write `satisfies Record<string, RoleSelector>` instead of `Parameters<Page["getByRole"]>` every time.

## The docs are the tests

Of course the [Playwright Utils docs](/docs/category/playwright-utils) are generated by Test2Doc. Every example on those pages is a test that passes in CI. The page about long polling doesn't just say `networkidle` times out, its test proves it, and if Playwright ever changes that behavior, the docs fail to generate instead of shipping a stale claim.

## Getting started

It needs `@playwright/test` 1.40 or newer and nothing else:

```bash
npm install --save-dev @test2doc/playwright-utils
```

Then swap a `networkidle` wait for a `clickUntil` on whatever your test does next. The [docs](/docs/category/playwright-utils) walk through every helper, and the [source](https://github.com/Null-Sweat-LLC/theDenverNexus/tree/main/packages/playwright-utils) is on GitHub.

If it saves you a flaky test, or you find one it doesn't fix, I'd love to hear about it. Hit me up on the [blueskies](https://bsky.app/profile/dethstrobe.bsky.social), [twitters](https://twitter.com/dethstrobe), or the [reddits](http://reddit.com/u/dethstrobe).
