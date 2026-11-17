import { describe, expect, it } from "vitest"
import { pngWithChanged } from "./testUtils/images.js"
import { changedPixelRatio } from "./utils.js"

describe("changedPixelRatio", () => {
  it("is 0 for identical images", () => {
    expect(
      changedPixelRatio(pngWithChanged(10, 10), pngWithChanged(10, 10)),
    ).toBe(0)
  })

  it("is the share of pixels that differ", () => {
    // 5 of 100 pixels
    expect(
      changedPixelRatio(pngWithChanged(10, 10), pngWithChanged(10, 10, 5)),
    ).toBe(0.05)
  })

  it("counts images of different sizes as entirely different", () => {
    expect(
      changedPixelRatio(pngWithChanged(10, 10), pngWithChanged(10, 11)),
    ).toBe(Number.POSITIVE_INFINITY)
  })

  it("counts an image that cannot be read as entirely different", () => {
    expect(
      changedPixelRatio(pngWithChanged(10, 10), Buffer.from("not a png")),
    ).toBe(Number.POSITIVE_INFINITY)
  })
})
