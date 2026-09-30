import { describe, expect, it } from "vitest"
import { renderMarkdown } from "./renderMarkdown.js"
import type { Guide, GuideBlock } from "./types.js"

const shot = (file: string, platform?: string): GuideBlock => ({
  type: "screenshot",
  images: [platform ? { platform, file } : { file }],
})
const guideOf = (title: string, blocks: GuideBlock[]): Guide => ({
  blocks: [],
  sections: [{ title, blocks }],
})

describe("renderMarkdown", () => {
  it("renders the flow name as the h1", () => {
    expect(renderMarkdown("Manage todos", { blocks: [], sections: [] })).toBe(
      "# Manage todos\n\n",
    )
  })

  it("renders each section as an h2", () => {
    expect(renderMarkdown("Guide", guideOf("Add a todo item", []))).toBe(
      "# Guide\n\n## Add a todo item\n\n",
    )
  })

  it("numbers instructions, restarting in each section", () => {
    const md = renderMarkdown("Guide", {
      blocks: [],
      sections: [
        {
          title: "One",
          blocks: [
            { type: "instruction", text: "Tap the field" },
            { type: "instruction", text: "Type a name" },
          ],
        },
        { title: "Two", blocks: [{ type: "instruction", text: "Tap Delete" }] },
      ],
    })

    expect(md).toContain("1. Tap the field\n\n2. Type a name\n\n")
    expect(md).toContain("## Two\n\n1. Tap Delete\n\n")
  })

  it("nests a screenshot under the instruction it follows", () => {
    const md = renderMarkdown(
      "Guide",
      guideOf("Add", [
        { type: "instruction", text: "Press Enter" },
        shot("a.png"),
      ]),
    )

    expect(md).toContain("1. Press Enter\n\n   ![Press Enter](./a.png)\n\n")
  })

  it("keeps the numbering going across a screenshot", () => {
    const md = renderMarkdown(
      "Guide",
      guideOf("Add", [
        { type: "instruction", text: "First" },
        shot("a.png"),
        { type: "instruction", text: "Second" },
      ]),
    )

    expect(md).toContain("2. Second\n\n")
  })

  it("renders a screenshot after other content on its own, with the section title as alt text", () => {
    const md = renderMarkdown(
      "Guide",
      guideOf("Mark it done", [
        { type: "markdown", text: "It is checked now." },
        shot("a.png"),
      ]),
    )

    expect(md).toContain("It is checked now.\n\n![Mark it done](./a.png)\n\n")
  })

  it("writes markdown blocks as they are", () => {
    const md = renderMarkdown(
      "Guide",
      guideOf("Delete", [
        { type: "markdown", text: ":::warning\nNo undo.\n:::" },
        { type: "markdown", text: "- one\n- two" },
      ]),
    )

    expect(md).toContain(":::warning\nNo undo.\n:::\n\n- one\n- two\n\n")
  })

  it("renders blocks before the first section, with the flow name as alt text", () => {
    const md = renderMarkdown("Guide", {
      blocks: [shot("a.png")],
      sections: [{ title: "Add", blocks: [] }],
    })

    expect(md).toBe("# Guide\n\n![Guide](./a.png)\n\n## Add\n\n")
  })

  describe("with several platforms", () => {
    const both: GuideBlock = {
      type: "screenshot",
      images: [
        { platform: "android", file: "android.png" },
        { platform: "web", file: "web.png" },
      ],
    }

    it("renders the screenshot as tabs, one per platform", () => {
      const md = renderMarkdown("Guide", guideOf("Add", [both]))

      expect(md).toContain(
        [
          '<Tabs groupId="platform">',
          '  <TabItem value="android" label="Android">',
          "",
          "![Add](./android.png)",
          "",
          "  </TabItem>",
          '  <TabItem value="web" label="Web">',
          "",
          "![Add](./web.png)",
          "",
          "  </TabItem>",
          "</Tabs>",
          "",
          "",
        ].join("\n"),
      )
    })

    it("imports the tab components once, above the title", () => {
      const md = renderMarkdown("Guide", guideOf("Add", [both, both]))

      expect(
        md.startsWith(
          'import Tabs from "@theme/Tabs"\nimport TabItem from "@theme/TabItem"\n\n# Guide',
        ),
      ).toBe(true)
      expect(md.match(/^import Tabs/gm)).toHaveLength(1)
    })

    it("does not nest tabs under an instruction", () => {
      const md = renderMarkdown(
        "Guide",
        guideOf("Add", [{ type: "instruction", text: "Tap" }, both]),
      )

      expect(md).toContain("1. Tap\n\n<Tabs")
    })

    it("labels well-known platforms properly", () => {
      const md = renderMarkdown(
        "Guide",
        guideOf("Add", [
          {
            type: "screenshot",
            images: [
              { platform: "ios", file: "i.png" },
              { platform: "tablet", file: "t.png" },
            ],
          },
        ]),
      )

      expect(md).toContain('label="iOS"')
      expect(md).toContain('label="Tablet"')
    })
  })

  it("does not import tabs for a single platform", () => {
    const md = renderMarkdown("Guide", guideOf("Add", [shot("a.png", "web")]))

    expect(md).not.toContain("Tabs")
  })
})
