import { PNG } from "pngjs"
import { describe, expect, it } from "vitest"
import { annotatePng } from "./annotate.js"

const gray = (width: number, height: number) => {
  const png = new PNG({ width, height })
  png.data.fill(136)
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255
  return PNG.sync.write(png)
}
const decode = (buffer: Buffer) => PNG.sync.read(buffer)
const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
})
const pixel = (png: PNG, x: number, y: number) => {
  const i = (png.width * y + x) * 4
  return [png.data[i], png.data[i + 1], png.data[i + 2]]
}
const changed = (before: PNG, after: PNG) => {
  const out: [number, number][] = []
  for (let y = 0; y < before.height; y++)
    for (let x = 0; x < before.width; x++)
      if (pixel(before, x, y).join() !== pixel(after, x, y).join())
        out.push([x, y])
  return out
}

describe("annotatePng", () => {
  const source = gray(400, 800)

  it("keeps the image size", () => {
    const out = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 1 }], 1),
    )

    expect([out.width, out.height]).toEqual([400, 800])
  })

  it("returns the image untouched when there is nothing to highlight", () => {
    expect(annotatePng(source, [], 1)).toEqual(source)
  })

  it("draws around the element and nowhere else", () => {
    const before = decode(source)
    const after = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 1 }], 1),
    )

    const points = changed(before, after)

    expect(points.length).toBeGreaterThan(0)
    expect(pixel(after, 399, 799)).toEqual(pixel(before, 399, 799))
    expect(pixel(after, 5, 400)).toEqual(pixel(before, 5, 400))
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(60)
      expect(x).toBeLessThanOrEqual(340)
      expect(y).toBeGreaterThanOrEqual(160)
      expect(y).toBeLessThanOrEqual(300)
    }
  })

  it("leaves the element itself readable, only tinting it", () => {
    const before = decode(source)
    const after = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 1 }], 1),
    )

    const [r0] = pixel(before, 200, 230)
    const [r1] = pixel(after, 200, 230)

    expect(Math.abs((r1 ?? 0) - (r0 ?? 0))).toBeLessThan(60)
  })

  it("puts a white number on a badge that differs by step", () => {
    const one = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 1 }], 1),
    )
    const two = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 2 }], 1),
    )

    const white = (png: PNG) =>
      changed(decode(source), png).filter(
        ([x, y]) => pixel(png, x, y).join() === "255,255,255",
      )

    expect(white(one).length).toBeGreaterThan(0)
    expect(one.data.equals(two.data)).toBe(false)
  })

  it("draws every highlight", () => {
    const before = decode(source)
    const after = decode(
      annotatePng(
        source,
        [
          { bounds: box(40, 100, 200, 140), step: 1 },
          { bounds: box(40, 600, 200, 640), step: 2 },
        ],
        1,
      ),
    )

    const ys = changed(before, after).map(([, y]) => y)

    expect(ys.some((y) => y < 200)).toBe(true)
    expect(ys.some((y) => y > 550)).toBe(true)
  })

  it("scales bounds from points to pixels", () => {
    const pixels = annotatePng(
      source,
      [{ bounds: box(99, 198, 300, 261), step: 1 }],
      1,
    )
    const points = annotatePng(
      source,
      [{ bounds: box(33, 66, 100, 87), step: 1 }],
      3,
    )

    expect(decode(points).data.equals(decode(pixels).data)).toBe(true)
  })

  it("stays inside the image for an element at the edge", () => {
    const out = decode(
      annotatePng(source, [{ bounds: box(0, 0, 50, 40), step: 12 }], 1),
    )

    expect([out.width, out.height]).toEqual([400, 800])
    expect(changed(decode(source), out).length).toBeGreaterThan(0)
  })

  it("draws numbers with more than one digit", () => {
    const out = decode(
      annotatePng(source, [{ bounds: box(100, 200, 300, 260), step: 10 }], 1),
    )

    expect(changed(decode(source), out).length).toBeGreaterThan(0)
  })
})
