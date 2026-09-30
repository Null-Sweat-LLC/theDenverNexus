import { describe, expect, it } from "vitest"
import { renderMarkdown } from "./renderMarkdown.js"

describe("renderMarkdown", () => {
  it("renders the flow name as the h1", () => {
    const md = renderMarkdown("Todo CRUD", { screenshots: [], steps: [] }, {})

    expect(md).toBe("# Todo CRUD\n\n")
  })

  it("renders each step title followed by its screenshots", () => {
    const md = renderMarkdown(
      "Todo CRUD",
      {
        screenshots: [],
        steps: [
          { title: "Create todo items", screenshots: ["takeScreenshot/a.png"] },
          { title: "Delete a todo item", screenshots: [] },
        ],
      },
      { "takeScreenshot/a.png": "test2doc-abc.png" },
    )

    expect(md).toBe(
      [
        "# Todo CRUD",
        "",
        "Create todo items",
        "![screenshot](./test2doc-abc.png)",
        "",
        "Delete a todo item",
        "",
        "",
      ].join("\n"),
    )
  })

  it("renders flow-level screenshots before the steps", () => {
    const md = renderMarkdown(
      "Flow",
      {
        screenshots: ["takeScreenshot/intro.png"],
        steps: [{ title: "Step", screenshots: [] }],
      },
      { "takeScreenshot/intro.png": "test2doc-intro.png" },
    )

    expect(md.indexOf("test2doc-intro.png")).toBeLessThan(md.indexOf("Step"))
  })
})
