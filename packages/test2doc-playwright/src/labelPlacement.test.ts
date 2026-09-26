import { test, expect, describe } from "vitest"
import { type Box, placeLabel } from "./labelPlacement.js"

const viewport = { width: 1280, height: 720 }
const label = { width: 200, height: 24 }
const margin = 24

const expectInsideViewport = (box: Box) => {
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

const expectOffTarget = (box: Box, target: Box) => {
  const overlaps =
    box.x < target.x + target.width &&
    target.x < box.x + box.width &&
    box.y < target.y + target.height &&
    target.y < box.y + box.height
  expect(overlaps).toBe(false)
}

describe("placeLabel", () => {
  test("keeps the preferred side when it fits", () => {
    const target = { x: 600, y: 300, width: 80, height: 30 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "above",
      margin,
    })

    expect(box).toEqual({
      x: 540,
      y: 300 - margin - label.height,
      width: label.width,
      height: label.height,
    })
  })

  test("wide target next to the left edge doesn't place the label off the left side", () => {
    const target = { x: 0, y: 300, width: 900, height: 40 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "left",
      margin,
    })

    expectInsideViewport(box)
    expectOffTarget(box, target)
    // opposite side (right) fits, so it's used
    expect(box.x).toBe(target.x + target.width + margin)
  })

  test.each([
    ["top left", { x: 0, y: 0, width: 120, height: 30 }],
    ["top right", { x: 1160, y: 0, width: 120, height: 30 }],
    ["bottom left", { x: 0, y: 690, width: 120, height: 30 }],
    ["bottom right", { x: 1160, y: 690, width: 120, height: 30 }],
  ])("target in the %s corner keeps the label inside the viewport", (_, target) => {
    const box = placeLabel({ target, label, viewport, margin })

    expectInsideViewport(box)
    expectOffTarget(box, target)
  })

  test("label that only overflows along the target's edge slides back inside instead of switching sides", () => {
    const target = { x: 0, y: 300, width: 60, height: 30 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "above",
      margin,
    })

    expect(box).toEqual({
      x: 0,
      y: 300 - margin - label.height,
      width: label.width,
      height: label.height,
    })
  })

  test("explicit position that doesn't fit falls back to the opposite side", () => {
    const target = { x: 600, y: 10, width: 80, height: 30 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "above",
      margin,
    })

    expectInsideViewport(box)
    expect(box.y).toBe(target.y + target.height + margin)
  })

  test("falls back to a perpendicular side when both the preferred and opposite sides don't fit", () => {
    const target = { x: 400, y: 0, width: 80, height: 720 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "above",
      margin,
    })

    expectInsideViewport(box)
    expectOffTarget(box, target)
  })

  test("numeric positions fall back too", () => {
    const target = { x: 600, y: 10, width: 80, height: 30 }
    const box = placeLabel({ target, label, viewport, position: 0, margin })

    expectInsideViewport(box)
    expectOffTarget(box, target)
  })

  test("target nearly as big as the viewport clamps the preferred box inside", () => {
    const target = { x: 10, y: 10, width: 1260, height: 700 }
    const box = placeLabel({
      target,
      label,
      viewport,
      position: "above",
      margin,
    })

    expectInsideViewport(box)
    expect(box.y).toBe(0)
    expect(box.x).toBe(540)
  })

  test("label wider than the viewport is pinned to the left edge", () => {
    const target = { x: 10, y: 10, width: 1260, height: 700 }
    const box = placeLabel({
      target,
      label: { width: 1500, height: 24 },
      viewport,
      position: "below",
      margin,
    })

    expect(box.x).toBe(0)
    expect(box.y).toBe(viewport.height - 24)
  })
})
