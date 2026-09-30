import { describe, expect, it } from "vitest"
import { mergeFlows } from "./mergeFlows.js"
import type { Flow } from "./types.js"

const flow = (shot: string): Flow => ({
  blocks: [],
  sections: [
    {
      title: "Add",
      blocks: [
        { type: "instruction", text: "Tap Add" },
        { type: "screenshot", path: shot },
      ],
    },
  ],
})

describe("mergeFlows", () => {
  it("resolves a single flow's screenshots to their output files", () => {
    const guide = mergeFlows([
      {
        flow: flow("takeScreenshot/a.png"),
        files: { "takeScreenshot/a.png": "a.png" },
      },
    ])

    expect(guide.sections[0]?.blocks).toEqual([
      { type: "instruction", text: "Tap Add" },
      { type: "screenshot", images: [{ file: "a.png" }] },
    ])
  })

  it("puts each platform's screenshot on the same block, in order", () => {
    const guide = mergeFlows([
      {
        platform: "android",
        flow: flow("takeScreenshot/a.png"),
        files: { "takeScreenshot/a.png": "android.png" },
      },
      {
        platform: "web",
        flow: flow("takeScreenshot/a.png"),
        files: { "takeScreenshot/a.png": "web.png" },
      },
    ])

    expect(guide.sections[0]?.blocks[1]).toEqual({
      type: "screenshot",
      images: [
        { platform: "android", file: "android.png" },
        { platform: "web", file: "web.png" },
      ],
    })
  })

  it("keeps the guide's text and structure", () => {
    const guide = mergeFlows([
      {
        platform: "a",
        flow: flow("takeScreenshot/a.png"),
        files: { "takeScreenshot/a.png": "a.png" },
      },
      {
        platform: "b",
        flow: flow("takeScreenshot/a.png"),
        files: { "takeScreenshot/a.png": "b.png" },
      },
    ])

    expect(guide.sections.map((s) => s.title)).toEqual(["Add"])
    expect(guide.sections[0]?.blocks[0]).toEqual({
      type: "instruction",
      text: "Tap Add",
    })
  })

  it("fails naming both platforms when the flows differ", () => {
    const other = flow("takeScreenshot/a.png")
    other.sections[0]?.blocks.push({ type: "markdown", text: "Only on web" })

    expect(() =>
      mergeFlows([
        {
          platform: "android",
          flow: flow("takeScreenshot/a.png"),
          files: { "takeScreenshot/a.png": "a.png" },
        },
        {
          platform: "web",
          flow: other,
          files: { "takeScreenshot/a.png": "w.png" },
        },
      ]),
    ).toThrow(/android.*web|web.*android/)
  })

  it("fails when the platforms took different screenshots", () => {
    expect(() =>
      mergeFlows([
        {
          platform: "android",
          flow: flow("takeScreenshot/a.png"),
          files: { "takeScreenshot/a.png": "a.png" },
        },
        {
          platform: "web",
          flow: flow("takeScreenshot/b.png"),
          files: { "takeScreenshot/b.png": "b.png" },
        },
      ]),
    ).toThrow(/differ/)
  })

  it("resolves screenshots that come before any section", () => {
    const f: Flow = {
      blocks: [{ type: "screenshot", path: "takeScreenshot/i.png" }],
      sections: [],
    }

    expect(
      mergeFlows([{ flow: f, files: { "takeScreenshot/i.png": "i.png" } }])
        .blocks,
    ).toEqual([{ type: "screenshot", images: [{ file: "i.png" }] }])
  })

  it("does not count highlights as a difference between platforms", () => {
    const withHighlight = (left: number): Flow => ({
      blocks: [],
      sections: [
        {
          title: "Add",
          blocks: [
            {
              type: "screenshot",
              path: "takeScreenshot/a.png",
              highlights: [
                {
                  bounds: { left, top: 1, right: left + 5, bottom: 9 },
                  step: 1,
                },
              ],
            },
          ],
        },
      ],
    })
    const files = { "takeScreenshot/a.png": "a.png" }

    const guide = mergeFlows([
      { platform: "android", flow: withHighlight(10), files },
      { platform: "web", flow: withHighlight(99), files },
    ])

    expect(guide.sections[0]?.blocks[0]).toEqual({
      type: "screenshot",
      images: [
        { platform: "android", file: "a.png" },
        { platform: "web", file: "a.png" },
      ],
    })
  })
})
