import { describe, expect, it } from "vitest"
import { annotatePng } from "./annotate.js"
import {
  isBlue,
  isOrange,
  isRed,
  isWhite,
  readPng,
  solidPng,
} from "./testUtils/images.js"
import type { Bounds, Highlight } from "./types.js"

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Bounds => ({ left, top, right, bottom })
const hl = (
  bounds: Bounds,
  text = "",
  options: Highlight["options"] = {},
): Highlight => ({ bounds, text, options })
const ELEMENT = box(100, 200, 300, 260)
const extent = (points: [number, number][]) =>
  points.reduce((max, [, y]) => Math.max(max, y), 0) -
  points.reduce((min, [, y]) => Math.min(min, y), Number.POSITIVE_INFINITY)

describe("annotatePng", () => {
  const source = solidPng(400, 800)

  it("returns the image untouched when there is nothing to highlight", () => {
    expect(annotatePng(source, [], 1, {})).toEqual(source)
  })

  it("keeps the image size", () => {
    const out = readPng(annotatePng(source, [hl(ELEMENT, "Tap here")], 1, {}))

    expect([out.width, out.height]).toEqual([400, 800])
  })

  describe("the highlight", () => {
    it("outlines the element in orange, like @test2doc/playwright", () => {
      const out = readPng(annotatePng(source, [hl(ELEMENT)], 1, {}))

      expect(isOrange(out.pixel(200, 199))).toBe(true)
      expect(isOrange(out.pixel(99, 230))).toBe(true)
    })

    it("tints the element but leaves it visible", () => {
      const out = readPng(annotatePng(source, [hl(ELEMENT)], 1, {}))

      const [r, g, b] = out.pixel(200, 230)
      expect([r, g, b]).not.toEqual([136, 136, 136])
      expect(isOrange([r, g, b])).toBe(false)
    })

    it("draws nothing else when there is no text", () => {
      const out = readPng(annotatePng(source, [hl(ELEMENT)], 1, {}))

      for (const [x, y] of out.changed()) {
        expect(x).toBeGreaterThanOrEqual(98)
        expect(x).toBeLessThanOrEqual(302)
        expect(y).toBeGreaterThanOrEqual(198)
        expect(y).toBeLessThanOrEqual(262)
      }
    })

    it("draws every highlight", () => {
      const out = readPng(
        annotatePng(
          source,
          [hl(box(40, 100, 200, 140)), hl(box(40, 600, 200, 640))],
          1,
          {},
        ),
      )

      const ys = out.changed().map(([, y]) => y)
      expect(ys.some((y) => y < 200)).toBe(true)
      expect(ys.some((y) => y > 550)).toBe(true)
    })

    it("scales bounds from points to pixels", () => {
      const pixels = annotatePng(
        source,
        [hl(box(99, 198, 300, 261), "Tap")],
        1,
        {},
      )
      const points = annotatePng(
        source,
        [hl(box(33, 66, 100, 87), "Tap")],
        3,
        {},
      )

      expect(readPng(points).changed()).toEqual(readPng(pixels).changed())
    })
  })

  describe("the label", () => {
    it("writes the text near the element", () => {
      const out = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap the field")], 1, {}),
      )

      const outside = out
        .changed()
        .filter(([x, y]) => y < 196 || y > 264 || x < 96 || x > 304)
      expect(outside.length).toBeGreaterThan(20)
    })

    it("uses the text in the annotation options over the step's", () => {
      const a = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap the field")], 1, {}),
      )
      const b = readPng(
        annotatePng(
          source,
          [hl(ELEMENT, "Tap the field", { text: "Here" })],
          1,
          {},
        ),
      )

      expect(b.changed().length).toBeLessThan(a.changed().length)
    })

    it("draws no label for empty text", () => {
      const out = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap", { text: "" })], 1, {}),
      )

      expect(out.changed().every(([, y]) => y >= 198 && y <= 262)).toBe(true)
    })

    it("puts it where position says", () => {
      const above = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap", { position: "above" })], 1, {}),
      )
      const below = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap", { position: "below" })], 1, {}),
      )

      expect(above.changed().some(([, y]) => y < 190)).toBe(true)
      expect(above.changed().every(([, y]) => y < 270)).toBe(true)
      expect(below.changed().some(([, y]) => y > 270)).toBe(true)
      expect(below.changed().every(([, y]) => y > 190)).toBe(true)
    })

    it("wraps long text inside the image", () => {
      const long =
        "Tap the text field at the top of the screen and then keep going for a while"
      const labelHeight = (text: string) => {
        const out = readPng(
          annotatePng(
            source,
            [hl(ELEMENT, text, { position: "below" })],
            1,
            {},
          ),
        )
        const label = out.changed().filter(([, y]) => y > 266)
        return { label, height: extent(label) }
      }

      const short = labelHeight("Tap")
      const wrapped = labelHeight(long)

      expect(wrapped.height).toBeGreaterThan(short.height + 10)
      expect(wrapped.label.every(([x]) => x >= 0 && x < 400)).toBe(true)
    })

    it("keeps the label inside the image for an element at the edge", () => {
      const out = readPng(
        annotatePng(source, [hl(box(0, 0, 60, 40), "Tap the corner")], 1, {}),
      )

      expect([out.width, out.height]).toEqual([400, 800])
      expect(out.changed().length).toBeGreaterThan(0)
    })
  })

  describe("the arrow", () => {
    const arrow = {
      position: "below",
      showArrow: true,
      arrowStrokeStyle: "rgb(255, 0, 0)",
    } as const

    it("points from the label to the element when showArrow is on", () => {
      const out = readPng(
        annotatePng(source, [hl(ELEMENT, "Tap here", arrow)], 1, {}),
      )

      const red = out.changed().filter(([x, y]) => isRed(out.pixel(x, y)))
      expect(red.length).toBeGreaterThan(10)
    })

    it("is off by default", () => {
      const out = readPng(
        annotatePng(
          source,
          [hl(ELEMENT, "Tap here", { position: "below" })],
          1,
          {},
        ),
      )

      expect(out.changed().some(([x, y]) => isRed(out.pixel(x, y)))).toBe(false)
    })

    it("keeps the label further from the element to leave room for it", () => {
      const bottomOfLabel = (options: Highlight["options"]) => {
        const out = readPng(
          annotatePng(source, [hl(ELEMENT, "Tap", options)], 1, {}),
        )
        return out.changed().reduce((max, [, y]) => Math.max(max, y), 0)
      }

      expect(
        bottomOfLabel({ position: "below", showArrow: true }),
      ).toBeGreaterThan(bottomOfLabel({ position: "below" }))
    })
  })

  describe("styling", () => {
    it("takes the highlight's colors from the options", () => {
      const out = readPng(
        annotatePng(
          source,
          [hl(ELEMENT, "", { highlightStrokeStyle: "rgb(0, 0, 255)" })],
          1,
          {},
        ),
      )

      // just outside the element's top edge, where only the outline reaches
      expect(isBlue(out.pixel(200, 199))).toBe(true)
    })

    it("takes defaults from the config, with the step's options winning", () => {
      const defaults = { highlightStrokeStyle: "rgb(0, 0, 255)" }

      const fromDefaults = readPng(
        annotatePng(source, [hl(ELEMENT)], 1, defaults),
      )
      const overridden = readPng(
        annotatePng(
          source,
          [hl(ELEMENT, "", { highlightStrokeStyle: "rgb(255, 0, 0)" })],
          1,
          defaults,
        ),
      )

      expect(isBlue(fromDefaults.pixel(200, 199))).toBe(true)
      expect(isRed(overridden.pixel(200, 199))).toBe(true)
    })

    it("fills the label box when a color is given", () => {
      const out = readPng(
        annotatePng(
          source,
          [
            hl(ELEMENT, "Hi", {
              position: "below",
              labelBoxFillStyle: "rgb(255, 255, 255)",
              labelBoxStrokeStyle: "rgb(0, 0, 0)",
            }),
          ],
          1,
          {},
        ),
      )

      const inBox = out.changed(136, { x1: 150, y1: 262, x2: 250, y2: 330 })
      expect(inBox.some(([x, y]) => isWhite(out.pixel(x, y)))).toBe(true)
    })

    it("leaves the label box unpainted by default", () => {
      const out = readPng(
        annotatePng(source, [hl(ELEMENT, "Hi", { position: "below" })], 1, {}),
      )

      expect(out.changed().some(([x, y]) => isWhite(out.pixel(x, y)))).toBe(
        false,
      )
    })

    it("uses the font it is given", () => {
      const size = (font?: string) => {
        const out = readPng(
          annotatePng(
            source,
            [
              hl(ELEMENT, "Tap", {
                position: "below",
                ...(font ? { font } : {}),
              }),
            ],
            1,
            {},
          ),
        )
        const points = out.changed().filter(([, y]) => y > 266)
        return (
          Math.max(...points.map(([, y]) => y)) -
          Math.min(...points.map(([, y]) => y))
        )
      }

      expect(size("40px Arial")).toBeGreaterThan(size("14px Arial") + 10)
    })

    it("still draws text when the font is not installed", () => {
      const out = readPng(
        annotatePng(
          source,
          [
            hl(ELEMENT, "Tap", {
              position: "below",
              font: "14px NoSuchFontAnywhere",
            }),
          ],
          1,
          {},
        ),
      )

      expect(out.changed().some(([, y]) => y > 266)).toBe(true)
    })
  })

  describe("sizes", () => {
    it("scale with the screenshot, so one style suits every platform", () => {
      const strokeOf = (width: number) => {
        const image = solidPng(width, width * 2)
        const unit = width / 400
        const out = readPng(
          annotatePng(
            image,
            [hl(box(100 * unit, 200 * unit, 300 * unit, 260 * unit))],
            1,
            {},
          ),
        )
        const top = Math.round(200 * unit)
        let thickness = 0
        for (let y = top - 20; y < top + 20; y++)
          if (isOrange(out.pixel(Math.round(200 * unit), y))) thickness++
        return thickness
      }

      expect(strokeOf(1200)).toBeGreaterThanOrEqual(strokeOf(400) * 2)
    })
  })
})
