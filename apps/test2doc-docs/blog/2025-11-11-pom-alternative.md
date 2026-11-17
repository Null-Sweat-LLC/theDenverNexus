---

slug: selector-tuple-vs-page-object-model
title: "Selector Tuple: An alternative to Page Object Model"
authors: [dethstrobe]
tags: [testing]
---

A common problem in automated tests is that selectors, the way in which you select an element on a page, can change over time as development implements new features or requirements.
{/* truncate */}

## Example

So let's say we have a test like this:

```ts
test("The app title", async ({ page }, pageInfo) => {
  await page.goto("/todo")

  const header = page.getByRole("heading", {
    name: "A very simple TODO app",
  })

  await expect(header).toBeVisible()
})
```

It's a very simple test, we get the heading element by its accessible name, and check to see if it is visible on the page.

In isolation, this is nothing, but when you have a few dozen tests using the same element, and we end up changing the name of the element because requirements change, this means we need to update several tests that may be in a few different files. It becomes messy and time consuming.

## Solutions for Changing Selectors

Here are some popular solutions, why I think they fall short, and what I recommend instead.

### The Problem with Test IDs

A popular solution is to add `testid`s to the HTML markup.

```html
<h1 data-testid="app-title">A very simple TODO app</h1>
```

The problem is that testids lead to lazy testing and hides accessibility issues.

#### Alternative to Test IDs

So instead of using `testid` attributes on your HTML, I highly recommend using the `getByRole` method. This tests your site similar to how people interact with your site.

Let's say we have a shopping cart with a button that will remove an item.

```html
<ul>
  <li>
    <img src="product1.jpg">
    <span>Product 1</span>
    <span>2</span>
    <button>Remove</button>
  </li>
  <li>
    <img src="product2.jpg">
    <span>Product 2</span>
    <span>1</span>
    <button>Remove</button>
  </li>
</ul>
```

If you cannot select the remove button because `getByRole("button", { name: "Remove" })` returns all the buttons with that name. The thing is, if you are having a hard time telling the difference between these elements with `getByRole`, then so are users that use screen readers. This is an accessibility red flag.

Test IDs should be the last line for being used as the selector, and should be avoided as much as possible.

If you can't get an element by it's role or identify it, it does imply that it's not very accessible. This is not a bullet proof way to ensure your site is accessible, but it does help because you're selecting elements the same as your users are.

### The Problem with Page Object Models (POM)

Another good solution to abstract away selectors and allow for easier refactoring is by creating a class that is designed to centralize this logic in one place.

A Page Object Model, POM.

```ts
import { expect, type Locator, type Page } from "@playwright/test"

export class PlaywrightDevPage {
  readonly page: Page
  readonly getCreateTodoLink: Locator
  readonly gettingTodoHeader: Locator
  readonly getInputName: Locator
  readonly getAddTodoButton: Locator

  constructor(page: Page) {
    this.page = page
    this.getCreateTodoLink = page.getByRole("link", {
      name: "Create a new todo",
    })
    this.gettingTodoHeader = page.getByRole("heading", {
      name: "A very simple TODO app",
    })
    this.getInputName = page.getByRole("textbox", { name: "Task Name" })
    this.getAddTodoButton = page.getByRole("button", { name: "Add" })
  }

  async goto() {
    await this.page.goto("/todo")
  }

  async onTodoPage() {
    await expect(this.gettingTodoHeader).toBeVisible()
  }

  async addTodo() {
    await this.getCreateTodoLink.click()
    await this.getInputName.fill("Buy ice cream")
    await this.getAddTodoButton.click()
  }
}
```

However, I am not a fan of this approach. This is a naive example, it still illustrates the point.

POMs often lead to creating premature abstractions. Let's say we need to extend our `addTodo` method. Like maybe we want to test submitting the todo by keyboard `enter`.

Do we extend the logic by adding parameters?

```ts
async addTodo(isSubmittedWithKeyboard: boolean) {
  await this.getCreateTodoLink.click()
  await this.getInputName.fill("Buy ice cream")
  if(isSubmittedWithKeyboard) {
    await this.getInputName.press('Enter')
  } else {
    await this.getAddTodoButton.click()
  }
}
```

Or maybe we just create a new method.

```ts
async addTodoSubmitWithKeyboard() {
  await this.getCreateTodoLink.click()
  await this.getInputName.fill("Buy ice cream")
  await this.getInputName.press('Enter')
}
```

I hate both of these approaches because the test obscures what's actually happening.

```ts
test("add item to todo", async ({ page }) => {
  const po = new PlaywrightDevPage(page)
  await po.addTodo()

  await expect(
    sharedPage.getByRole("listitem", { name: "Buy ice cream" }),
  ).toBeVisible()
})
```

Or we even hide the expect inside the POM and make the test even less readable. A test should be self-documenting at a glance.

I'm not saying, never have abstractions. But instead follow Kent C. Dodds' philosophy of [Avoid Hasty Abstractions](https://kentcdodds.com/blog/aha-programming). I am arguing that POM is inherently a **hasty abstraction**.

#### Alternative to POMs

So to avoid the problem with POMs instead of abstracting and hiding how the test case works in another file, instead we only focus on centralizing the arguments that are used for selecting elements.

I call this pattern **Selector Tuple**.

## Selector Tuple

We'll take the arguments for the `getByRole` method and put that in one place.

```ts
import type { Page } from "@playwright/test"

export const selectors = {
  linkCreateTodo: ["link", { name: "Create a new todo" }],
  headingTodoApp: ["heading", { name: "A very simple TODO app" }],
  inputTaskName: ["textbox", { name: "Task Name" }],
  buttonAdd: ["button", { name: "Add" }],
} satisfies Record<string, Parameters<Page["getByRole"]>>
```

We're using the `satisfies` TypeScript keyword to create type-safe tuples that can be safely spread as arguments to `getByRole`. This approach lets TypeScript infer the strict literal types of our keys, giving us autocomplete in our IDE without needing to explicitly type the object.

Centralizing all your selectors in one place makes it easy to add, remove, or update them. If you need to update a selector because we've changed copy on a button or link, we can do it from one location that will update all references. While this is still an abstraction, it’s not a _hasty_ abstraction as each key has a single, clear responsibility; selecting an element.

This pattern also can be used for other Playwright methods, like `getByLabel`, `getByTitle`, [etc](https://playwright.dev/docs/locators#quick-guide). But I find `getByRole` to be the best one to use.

Then in the test we spread the tuple into the `getByRole` calls.

```ts
import { test, expect } from "@playwright/test"
import { selectors } from "./selectors"

test("The app title", async ({ page }) => {
  await page.goto("/todo")

  const header = page.getByRole(...selectors.headingTodoApp)

  await expect(header).toBeVisible()
})
```

- The test still can be read and explain what is under test.
- It is just abstract enough so that if the only thing that changes is copy or translations, we just need to update it in the Selector Tuple and all tests get updated.
- We keep our accessible selectors.
- A single source of truth to update selectors across the code base.

## Keep It Simple

POMs try to do too much. Selector Tuple does one thing well: centralize your selectors so you're not chasing them across a dozen test files.

Your tests remain clear and intentional. Your selectors stay maintainable. Your site stays accessible. That's the sweet spot.
