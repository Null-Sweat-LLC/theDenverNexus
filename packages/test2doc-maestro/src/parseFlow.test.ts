import { beforeEach, describe, expect, it } from "vitest"
import {
  entry,
  resetSequence,
  screenshot,
  section,
} from "./testUtils/commands.js"
import { parseFlow } from "./parseFlow.js"

describe("parseFlow", () => {
  beforeEach(resetSequence)

  it("turns each labeled runFlow into a step, in order", () => {
    const flow = parseFlow([
      entry("launchAppCommand"),
      section("Create todo items"),
      entry("tapOnElement", { depth: 2 }),
      section("Delete a todo item"),
    ])

    expect(flow.steps.map((step) => step.title)).toEqual([
      "Create todo items",
      "Delete a todo item",
    ])
  })

  it("orders steps by sequenceNumber, not array position", () => {
    const second = section("Second")
    const first = section("First")
    ;[first, second].forEach((e, i) => {
      e.metadata.sequenceNumber = i
    })

    const flow = parseFlow([second, first])

    expect(flow.steps.map((step) => step.title)).toEqual(["First", "Second"])
  })

  it("ignores runFlow commands that have no label", () => {
    const flow = parseFlow([
      entry("runFlowCommand", { depth: 2 }),
      section("Only step"),
    ])

    expect(flow.steps).toHaveLength(1)
  })

  it("attaches a screenshot to the labeled section it happened in", () => {
    const flow = parseFlow([
      section("Create todo items"),
      entry("runFlowCommand", { depth: 2 }),
      screenshot("created"),
      section("Delete a todo item"),
      screenshot("deleted"),
    ])

    expect(flow.steps.map((step) => step.screenshots)).toEqual([
      ["takeScreenshot/created.png"],
      ["takeScreenshot/deleted.png"],
    ])
  })

  it("keeps several screenshots in one step in order", () => {
    const flow = parseFlow([
      section("Create todo items"),
      screenshot("one"),
      screenshot("two"),
    ])

    expect(flow.steps[0]?.screenshots).toEqual([
      "takeScreenshot/one.png",
      "takeScreenshot/two.png",
    ])
  })

  it("puts screenshots taken before any section on the flow itself", () => {
    const flow = parseFlow([screenshot("intro", 1), section("First step")])

    expect(flow.screenshots).toEqual(["takeScreenshot/intro.png"])
    expect(flow.steps[0]?.screenshots).toEqual([])
  })

  it("ignores screenshot commands that did not complete", () => {
    const skipped = entry("takeScreenshotCommand", {
      depth: 4,
      status: "SKIPPED",
    })

    const flow = parseFlow([section("Step"), skipped])

    expect(flow.steps[0]?.screenshots).toEqual([])
  })

  it("closes a nested section when a sibling starts at the same depth", () => {
    const flow = parseFlow([
      section("Outer"),
      section("Inner", 2),
      screenshot("inner-shot", 3),
      section("Next outer"),
      screenshot("outer-shot", 2),
    ])

    expect(flow.steps.map((s) => [s.title, s.screenshots])).toEqual([
      ["Outer", []],
      ["Inner", ["takeScreenshot/inner-shot.png"]],
      ["Next outer", ["takeScreenshot/outer-shot.png"]],
    ])
  })

  it("throws naming the command when the flow has a failed command", () => {
    expect(() =>
      parseFlow([section("Step"), entry("tapOnElement", { status: "FAILED" })]),
    ).toThrow(/tapOnElement/)
  })
})
