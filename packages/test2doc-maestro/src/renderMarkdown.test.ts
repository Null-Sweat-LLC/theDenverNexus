import { describe, expect, it } from "vitest"
import { renderMarkdown } from "./renderMarkdown.js"
import type { Block, Flow } from "./types.js"

const names = { "takeScreenshot/a.png": "test2doc-a.png" }
const flowOf = (title: string, blocks: Block[]): Flow => ({
  blocks: [],
  sections: [{ title, blocks }],
})

describe("renderMarkdown", () => {
  it("renders the flow name as the h1", () => {
    const md = renderMarkdown("Manage todos", { blocks: [], sections: [] }, {})

    expect(md).toBe("# Manage todos\n\n")
  })

  it("renders each section as an h2", () => {
    const md = renderMarkdown("Guide", flowOf("Add a todo item", []), {})

    expect(md).toBe("# Guide\n\n## Add a todo item\n\n")
  })

  it("numbers instructions, restarting in each section", () => {
    const md = renderMarkdown(
      "Guide",
      {
        blocks: [],
        sections: [
          {
            title: "One",
            blocks: [
              { type: "instruction", text: "Tap the field" },
              { type: "instruction", text: "Type a name" },
            ],
          },
          {
            title: "Two",
            blocks: [{ type: "instruction", text: "Tap Delete" }],
          },
        ],
      },
      {},
    )

    expect(md).toContain("1. Tap the field\n\n2. Type a name\n\n")
    expect(md).toContain("## Two\n\n1. Tap Delete\n\n")
  })

  it("nests a screenshot under the instruction it follows", () => {
    const md = renderMarkdown(
      "Guide",
      flowOf("Add", [
        { type: "instruction", text: "Press Enter" },
        { type: "screenshot", path: "takeScreenshot/a.png" },
      ]),
      names,
    )

    expect(md).toContain(
      "1. Press Enter\n\n   ![Press Enter](./test2doc-a.png)\n\n",
    )
  })

  it("keeps the numbering going across a screenshot", () => {
    const md = renderMarkdown(
      "Guide",
      flowOf("Add", [
        { type: "instruction", text: "First" },
        { type: "screenshot", path: "takeScreenshot/a.png" },
        { type: "instruction", text: "Second" },
      ]),
      names,
    )

    expect(md).toContain("2. Second\n\n")
  })

  it("renders a screenshot that follows other content on its own, alt text is the section title", () => {
    const md = renderMarkdown(
      "Guide",
      flowOf("Mark it done", [
        { type: "markdown", text: "It is checked now." },
        { type: "screenshot", path: "takeScreenshot/a.png" },
      ]),
      names,
    )

    expect(md).toContain(
      "It is checked now.\n\n![Mark it done](./test2doc-a.png)\n\n",
    )
  })

  it("writes markdown blocks as they are", () => {
    const md = renderMarkdown(
      "Guide",
      flowOf("Add", [{ type: "markdown", text: "Your list starts empty." }]),
      {},
    )

    expect(md).toContain("## Add\n\nYour list starts empty.\n\n")
  })

  it("passes admonitions and other markdown through untouched", () => {
    const md = renderMarkdown(
      "Guide",
      flowOf("Delete", [
        { type: "markdown", text: ":::warning\nNo undo.\n:::" },
        { type: "markdown", text: "- one\n- two" },
      ]),
      {},
    )

    expect(md).toContain(":::warning\nNo undo.\n:::\n\n- one\n- two\n\n")
  })

  it("renders blocks that come before the first section, using the flow name as alt text", () => {
    const md = renderMarkdown(
      "Guide",
      {
        blocks: [{ type: "screenshot", path: "takeScreenshot/a.png" }],
        sections: [{ title: "Add", blocks: [] }],
      },
      names,
    )

    expect(md).toBe("# Guide\n\n![Guide](./test2doc-a.png)\n\n## Add\n\n")
  })

  it("fails when a screenshot has no output file", () => {
    expect(() =>
      renderMarkdown(
        "Guide",
        flowOf("Add", [{ type: "screenshot", path: "takeScreenshot/a.png" }]),
        {},
      ),
    ).toThrow(/takeScreenshot\/a\.png/)
  })
})
