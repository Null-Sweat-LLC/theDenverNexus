import { describe, expect, it } from "vitest"
import { detectScale, matchTaps, parseTaps } from "./taps.js"
import { entry, resetSequence } from "./testUtils/commands.js"
import type { CommandEntry } from "./types.js"

const androidLine = (attrs: string) =>
  `13:24:25.428 [ INFO] maestro.Maestro.tap-HgV9Ck0: Tapping on element:  UiElement(treeNode=TreeNode(attributes={${attrs}}, children=[], clickable=true, enabled=true, focused=false, checked=false, selected=false), bounds=Bounds(x=42, y=310, width=846, height=99), hierarchyIndex=null)`

const ANDROID_FIELD = androidLine(
  "text=, accessibilityText=, hintText=What needs doing?, ignoreBoundsFiltering=false, resource-id=todo-input, clickable=true, bounds=[42,310][888,409], enabled=true",
)
const ANDROID_ITEM = androidLine(
  "text=☐ Buy milk, accessibilityText=, hintText=, ignoreBoundsFiltering=false, resource-id=, clickable=false, bounds=[42,439][849,548], enabled=true",
)
const IOS_FIELD =
  "13:25:38.258 [ INFO] maestro.Maestro.tap-HgV9Ck0: Tapping on element:  UiElement(treeNode=TreeNode(attributes={accessibilityText=, title=, value=, text=, hintText=What needs doing?, resource-id=todo-input, bounds=[17,124][327,157], enabled=true, focused=false, selected=false, checked=false}, children=[], clickable=null), bounds=Bounds(x=17, y=124, width=310, height=33))"
const WEB_FIELD =
  "13:26:06.163 [ INFO] maestro.Maestro.tap-HgV9Ck0: Tapping on element:  UiElement(treeNode=TreeNode(attributes={text=What needs doing?, bounds=[16,61][426,96], resource-id=todo-input}, children=[], clickable=null, enabled=null), bounds=Bounds(x=16, y=61, width=410, height=35))"
const NOISE =
  "13:24:27.050 [ INFO] maestro.Maestro.hierarchyBasedTap-ogj28Uc: Tapping at (465, 359) using hierarchy based logic for wait"

const tapEntry = (
  selector: Record<string, string>,
  status = "COMPLETED",
): CommandEntry => {
  const e = entry("tapOnElement", { depth: 2, status })
  e.command.tapOnElement = { selector }
  return e
}

describe("parseTaps", () => {
  it("reads the bounds of each tapped element, in order", () => {
    const taps = parseTaps([ANDROID_FIELD, NOISE, ANDROID_ITEM].join("\n"))

    expect(taps.map((t) => t.bounds)).toEqual([
      { left: 42, top: 310, right: 888, bottom: 409 },
      { left: 42, top: 439, right: 849, bottom: 548 },
    ])
  })

  it("reads the element attributes", () => {
    const [tap] = parseTaps(ANDROID_ITEM)

    expect(tap?.attrs["text"]).toBe("☐ Buy milk")
    expect(tap?.attrs["resource-id"]).toBe("")
  })

  it("reads iOS and web logs too", () => {
    expect(parseTaps(IOS_FIELD)[0]?.bounds).toEqual({
      left: 17,
      top: 124,
      right: 327,
      bottom: 157,
    })
    expect(parseTaps(WEB_FIELD)[0]?.bounds).toEqual({
      left: 16,
      top: 61,
      right: 426,
      bottom: 96,
    })
  })

  it("marks taps from an iOS log, which reports points", () => {
    expect(parseTaps(IOS_FIELD)[0]?.ios).toBe(true)
    expect(parseTaps(ANDROID_FIELD)[0]?.ios).toBe(false)
    expect(parseTaps(WEB_FIELD)[0]?.ios).toBe(false)
  })

  it("ignores lines without a tapped element", () => {
    expect(parseTaps(NOISE)).toEqual([])
    expect(parseTaps("")).toEqual([])
  })
})

describe("matchTaps", () => {
  const taps = parseTaps([ANDROID_FIELD, ANDROID_ITEM].join("\n"))

  it("pairs each tap command with the logged element it tapped", () => {
    resetSequence()
    const field = tapEntry({ idRegex: "todo-input" })
    const item = tapEntry({ textRegex: "☐ Buy milk" })

    const matched = matchTaps([field, item], taps)

    expect(matched.get(field.metadata.sequenceNumber)?.left).toBe(42)
    expect(matched.get(item.metadata.sequenceNumber)?.top).toBe(439)
  })

  it("skips a logged tap that belongs to no command, such as a retry", () => {
    resetSequence()
    const again = parseTaps(
      [ANDROID_FIELD, ANDROID_FIELD, ANDROID_ITEM].join("\n"),
    )
    const field = tapEntry({ idRegex: "todo-input" })
    const item = tapEntry({ textRegex: "☐ Buy milk" })

    const matched = matchTaps([field, item], again)

    expect(matched.get(item.metadata.sequenceNumber)?.top).toBe(439)
  })

  it("matches the whole text, like Maestro does, and accepts a regex", () => {
    resetSequence()
    const exact = tapEntry({ textRegex: "Buy milk" })
    const pattern = tapEntry({ textRegex: "☐ Buy.*" })

    expect(matchTaps([exact], taps).size).toBe(0)
    expect(matchTaps([pattern], taps).size).toBe(1)
  })

  it("matches the element's hint text too", () => {
    resetSequence()
    const byHint = tapEntry({ textRegex: "What needs doing\\?" })

    expect(matchTaps([byHint], taps).size).toBe(1)
  })

  it("leaves a command unmatched when nothing in the log fits its selector", () => {
    resetSequence()
    const missing = tapEntry({ idRegex: "nope" })

    expect(matchTaps([missing], taps).size).toBe(0)
  })

  it("ignores taps that did not complete and commands that are not taps", () => {
    resetSequence()
    const failed = tapEntry({ idRegex: "todo-input" }, "FAILED")
    const other = entry("inputTextCommand", { depth: 2 })

    expect(matchTaps([failed, other], taps).size).toBe(0)
  })

  it("does not reuse one logged tap for two commands", () => {
    resetSequence()
    const one = tapEntry({ idRegex: "todo-input" })
    const two = tapEntry({ idRegex: "todo-input" })

    expect(matchTaps([one, two], taps).size).toBe(1)
  })
})

describe("detectScale", () => {
  const ios = parseTaps(IOS_FIELD)
  const android = parseTaps(ANDROID_FIELD)

  it("uses the scale it was given", () => {
    expect(detectScale(ios, 1206, 2)).toBe(2)
  })

  it("is 1 when the log does not report points", () => {
    expect(detectScale(android, 1080)).toBe(1)
    expect(detectScale(parseTaps(WEB_FIELD), 500)).toBe(1)
  })

  it.each([
    [1206, 3], // iPhone 16 Pro, 402 pt
    [1170, 3], // 390 pt
    [1242, 3], // 414 pt
    [828, 2], // iPhone 11, 414 pt
    [750, 2], // 375 pt
    [2048, 2], // iPad, 1024 pt
  ])("works out the iOS scale for a %ipx wide screenshot", (width, scale) => {
    expect(detectScale(ios, width)).toBe(scale)
  })

  it("gives up rather than guess when the width is not a known size", () => {
    expect(detectScale(ios, 1234)).toBeUndefined()
  })
})
