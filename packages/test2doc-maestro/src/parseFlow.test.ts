import { beforeEach, describe, expect, it } from "vitest"
import { CALLOUT_KINDS } from "./types.js"
import { parseFlow } from "./parseFlow.js"
import {
  callout,
  entry,
  instruction,
  resetSequence,
  screenshot,
  section,
  text,
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

  it.each(CALLOUT_KINDS)("turns a [%s] label into a callout", (kind) => {
    const flow = parseFlow([section("Step"), callout(kind, "Be careful")])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "callout", kind, text: "Be careful" },
    ])
  })

  it("reads callout prefixes regardless of case", () => {
    const flow = parseFlow([
      section("Step"),
      entry("evalScriptCommand", { depth: 2, label: "[WARNING] Loud" }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "callout", kind: "warning", text: "Loud" },
    ])
  })

  it("turns a [text] label into a paragraph", () => {
    const flow = parseFlow([section("Step"), text("Some explanation.")])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "text", text: "Some explanation." },
    ])
  })

  it("keeps an unknown bracket prefix as part of an instruction", () => {
    const flow = parseFlow([
      section("Step"),
      entry("tapOnElement", { depth: 2, label: "[beta] Tap it" }),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "instruction", text: "[beta] Tap it" },
    ])
  })

  it("keeps instructions, text, callouts and screenshots in sequence", () => {
    const flow = parseFlow([
      section("Delete a todo item"),
      callout("warning", "This cannot be undone."),
      instruction("Tap Delete"),
      text("The item is gone."),
      screenshot("deleted"),
    ])

    expect(flow.sections[0]?.blocks).toEqual([
      { type: "callout", kind: "warning", text: "This cannot be undone." },
      { type: "instruction", text: "Tap Delete" },
      { type: "text", text: "The item is gone." },
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
})
