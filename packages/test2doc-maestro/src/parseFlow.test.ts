import { beforeEach, describe, expect, it } from "vitest"
import { parseFlow } from "./parseFlow.js"
import type { Bounds, Highlight } from "./types.js"
import {
  entry,
  instruction,
  markdown,
  resetSequence,
  screenshot,
  section,
} from "./testUtils/commands.js"

describe("parseFlow", () => {
  beforeEach(resetSequence)

  it("turns each labeled runFlow into a section, in order", () => {
    const flow = parseFlow([
      entry("launchAppCommand"),
      section("Add a todo item"),
      entry("tapOnElement", { depth: 2 }),
      section("Delete a todo item"),
    ])

    expect(flow.sections.map((s) => s.title)).toEqual([
      "Add a todo item",
      "Delete a todo item",
    ])
  })

  it("orders sections by sequenceNumber, not array position", () => {
    const second = section("Second")
    const first = section("First")
    first.metadata.sequenceNumber = 0
    second.metadata.sequenceNumber = 1

    const flow = parseFlow([second, first])

    expect(flow.sections.map((s) => s.title)).toEqual(["First", "Second"])
  })

  it("ignores runFlow commands that have no label", () => {
    const flow = parseFlow([
      entry("runFlowCommand", { depth: 2 }),
      section("Only section"),
    ])

    expect(flow.sections).toHaveLength(1)
  })

  it("turns labeled commands into instructions, in order", () => {
    const flow = parseFlow([
      section("Add a todo item"),
      instruction("Tap the text field"),
      instruction("Type a name"),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "instruction", text: "Tap the text field" },
      { type: "instruction", text: "Type a name" },
    ])
  })

  it("ignores commands that have no label", () => {
    const flow = parseFlow([
      section("Add a todo item"),
      entry("tapOnElement", { depth: 2 }),
      entry("assertConditionCommand", { depth: 2 }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([])
  })

  it("prefers the evaluated label, where Maestro resolved variables", () => {
    const flow = parseFlow([
      section("Add a todo item"),
      entry("tapOnElement", {
        depth: 2,
        label: "Tap <who>",
        evaluatedLabel: "Tap world",
      }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "instruction", text: "Tap world" },
    ])
  })

  it("turns a labeled evalScript into a markdown block, verbatim", () => {
    const flow = parseFlow([
      section("Step"),
      markdown(":::tip\nRepeat as often as you like.\n:::\n"),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "markdown", text: ":::tip\nRepeat as often as you like.\n:::" },
    ])
  })

  it("does not treat a bracket prefix specially", () => {
    const flow = parseFlow([
      section("Step"),
      markdown("[warning] Loud"),
      entry("tapOnElement", { depth: 2, label: "[beta] Tap it" }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "markdown", text: "[warning] Loud" },
      { type: "instruction", text: "[beta] Tap it" },
    ])
  })

  it("ignores an evalScript that has no label", () => {
    const flow = parseFlow([
      section("Step"),
      entry("evalScriptCommand", { depth: 2 }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([])
  })

  it("keeps instructions, markdown and screenshots in sequence", () => {
    const flow = parseFlow([
      section("Delete a todo item"),
      markdown(":::warning\nThis cannot be undone.\n:::"),
      instruction("Tap Delete"),
      markdown("The item is gone."),
      screenshot("deleted"),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "markdown", text: ":::warning\nThis cannot be undone.\n:::" },
      { type: "instruction", text: "Tap Delete" },
      { type: "markdown", text: "The item is gone." },
      { type: "screenshot", path: "takeScreenshot/deleted.png" },
    ])
  })

  it("puts blocks that come before any section on the flow itself", () => {
    const flow = parseFlow([screenshot("intro", 1), section("First")])

    expect(flow.blocks).toEqual([
      { type: "screenshot", path: "takeScreenshot/intro.png" },
    ])
    expect(flow.sections[0]?.blocks).toEqual([])
  })

  it("ignores commands that did not complete", () => {
    const flow = parseFlow([
      section("Step"),
      entry("takeScreenshotCommand", { depth: 4, status: "SKIPPED" }),
      entry("tapOnElement", { depth: 2, label: "Skipped", status: "SKIPPED" }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([])
  })

  it("closes a nested section when a sibling starts at the same depth", () => {
    const flow = parseFlow([
      section("Outer"),
      section("Inner", 2),
      screenshot("inner-shot", 3),
      section("Next outer"),
      screenshot("outer-shot", 2),
    ])

    expect(flow.sections.map((s) => [s.title, s.blocks])).toEqual([
      ["Outer", []],
      [
        "Inner",
        [{ type: "screenshot", path: "takeScreenshot/inner-shot.png" }],
      ],
      [
        "Next outer",
        [{ type: "screenshot", path: "takeScreenshot/outer-shot.png" }],
      ],
    ])
  })

  it("throws naming the command when the flow has a failed command", () => {
    expect(() =>
      parseFlow([section("Step"), entry("tapOnElement", { status: "FAILED" })]),
    ).toThrow(/tapOnElement/)
  })

  describe("highlights", () => {
    const at = (n: number): Bounds => ({
      left: n,
      top: n,
      right: n + 10,
      bottom: n + 10,
    })
    const boundsFor = (
      ...taps: [{ metadata: { sequenceNumber: number } }, Bounds][]
    ) => new Map(taps.map(([e, b]) => [e.metadata.sequenceNumber, b]))
    const shotBlock = (path: string, highlights?: Highlight[]) => ({
      type: "screenshot",
      path: `takeScreenshot/${path}.png`,
      ...(highlights ? { highlights } : {}),
    })

    it("highlights the element a later step taps on the screenshot before it", () => {
      const [sec, shot, step] = [
        section("Add"),
        screenshot("before"),
        instruction("Tap the field"),
      ]

      const flow = parseFlow([sec, shot, step], boundsFor([step, at(5)]))

      expect(flow.sections[0]?.blocks[0]).toEqual(
        shotBlock("before", [{ bounds: at(5), text: "Tap the field" }]),
      )
    })

    it("annotates with the step's words, without its markdown", () => {
      const [sec, shot, step] = [
        section("Add"),
        screenshot("before"),
        instruction("Press **Enter** now"),
      ]

      const flow = parseFlow([sec, shot, step], boundsFor([step, at(1)]))

      expect(flow.sections[0]?.blocks[0]).toEqual(
        shotBlock("before", [{ bounds: at(1), text: "Press Enter now" }]),
      )
    })

    it("takes annotation options from the step's label, and keeps them out of the step's text", () => {
      const [sec, shot, step] = [
        section("Add"),
        screenshot("before"),
        instruction(
          'Tap the field [test2doc_annotation]:{"position":"below","text":"Field"}',
        ),
      ]

      const flow = parseFlow([sec, shot, step], boundsFor([step, at(1)]))

      expect(flow.sections[0]?.blocks[0]).toEqual(
        shotBlock("before", [
          {
            bounds: at(1),
            text: "Tap the field",
            options: { position: "below", text: "Field" },
          },
        ]),
      )
      expect(flow.sections[0]?.blocks[1]).toEqual({
        type: "instruction",
        text: "Tap the field",
      })
    })

    it("collects several taps on one screenshot", () => {
      const [sec, shot, a, b] = [
        section("S"),
        screenshot("before"),
        instruction("One"),
        instruction("Two"),
      ]

      const flow = parseFlow(
        [sec, shot, a, b],
        boundsFor([a, at(1)], [b, at(2)]),
      )

      expect(flow.sections[0]?.blocks[0]).toEqual(
        shotBlock("before", [
          { bounds: at(1), text: "One" },
          { bounds: at(2), text: "Two" },
        ]),
      )
    })

    it("does not highlight on a screenshot that comes after the tap", () => {
      const [sec, step, shot] = [
        section("S"),
        instruction("Tap it"),
        screenshot("after"),
      ]

      const flow = parseFlow([sec, step, shot], boundsFor([step, at(1)]))

      expect(flow.sections[0]?.blocks[1]).toEqual(shotBlock("after"))
    })

    it("gives a tap to the nearest screenshot above it", () => {
      const [sec, first, second, step] = [
        section("S"),
        screenshot("first"),
        screenshot("second"),
        instruction("Tap it"),
      ]

      const flow = parseFlow(
        [sec, first, second, step],
        boundsFor([step, at(1)]),
      )

      expect(flow.sections[0]?.blocks).toEqual([
        shotBlock("first"),
        shotBlock("second", [{ bounds: at(1), text: "Tap it" }]),
        { type: "instruction", text: "Tap it" },
      ])
    })

    it("does not carry a screenshot's highlights into the next section", () => {
      const [one, shot, two, step] = [
        section("One"),
        screenshot("shot"),
        section("Two"),
        instruction("Tap it"),
      ]

      const flow = parseFlow([one, shot, two, step], boundsFor([step, at(1)]))

      expect(flow.sections[0]?.blocks[0]).toEqual(shotBlock("shot"))
    })

    it("ignores steps whose tap has no bounds", () => {
      const flow = parseFlow(
        [section("S"), screenshot("shot"), instruction("Tap it")],
        new Map(),
      )

      expect(flow.sections[0]?.blocks[0]).toEqual(shotBlock("shot"))
    })

    it("ignores bounds for taps that have no label", () => {
      const [sec, shot, step] = [
        section("S"),
        screenshot("shot"),
        entry("tapOnElement", { depth: 2 }),
      ]

      const flow = parseFlow([sec, shot, step], boundsFor([step, at(1)]))

      expect(flow.sections[0]?.blocks[0]).toEqual(shotBlock("shot"))
    })
  })
})
