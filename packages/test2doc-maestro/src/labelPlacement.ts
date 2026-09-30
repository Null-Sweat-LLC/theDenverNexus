// Ported from @test2doc/playwright so both packages place labels the same way.
export type Position = "above" | "below" | "left" | "right" | number

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface PlaceLabelOptions {
  target: Box // Element the label points at
  label: Size // Label box size, padding included
  viewport: Size
  position?: Position | undefined // Preferred side, defaults to towards the viewport center
  margin: number // Gap between the target and the label box
}

/**
 * Converts a Position to a math convention angle (0° = right, 90° = down).
 * Numeric positions use the clock convention (0° = top).
 */
export const toDegree = (pos: Position): number => {
  if (typeof pos === "number") return (((pos + 270) % 360) + 360) % 360
  switch (pos) {
    case "above":
      return 270
    case "right":
      return 0
    case "below":
      return 90
    case "left":
      return 180
  }
}

const getCenter = (box: Box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
})

/**
 * Clock convention angle (0° = top) from the target's center towards the viewport center.
 */
export const getAutoPosition = (target: Box, viewport: Size): number => {
  const center = getCenter(target)
  const dx = viewport.width / 2 - center.x
  const dy = viewport.height / 2 - center.y

  let angle = Math.atan2(dy, dx) * (180 / Math.PI)
  if (angle < 0) angle += 360

  return (angle + 90) % 360
}

/**
 * Places the label box just past the target's edge along the ray at `degree` (math convention).
 */
export function getLabelBox(
  target: Box,
  label: Size,
  degree: number,
  margin: number,
): Box {
  const center = getCenter(target)
  const radians = (degree * Math.PI) / 180
  const sinT = Math.sin(radians)
  const cosT = Math.cos(radians)

  // Lines the label center can sit on
  const yTop = target.y - margin - label.height / 2
  const yBottom = target.y + target.height + margin + label.height / 2
  const xLeft = target.x - margin - label.width / 2
  const xRight = target.x + target.width + margin + label.width / 2

  const toBox = (x: number, y: number): Box => ({
    x: x - label.width / 2,
    y: y - label.height / 2,
    width: label.width,
    height: label.height,
  })

  // Vertical rays (90° and 270°)
  if (Math.abs(cosT) < 1e-6) {
    return toBox(center.x, sinT > 0 ? yBottom : yTop)
  }

  // Horizontal rays (0° and 180°)
  if (Math.abs(sinT) < 1e-6) {
    return toBox(cosT > 0 ? xRight : xLeft, center.y)
  }

  // For diagonal rays, intersect with horizontal line
  const yTarget = sinT < 0 ? yTop : yBottom
  const x = center.x + ((yTarget - center.y) / sinT) * cosT

  // If x goes out of bounds, intersect with vertical line instead
  if (x < xLeft || x > xRight) {
    const xEdge = x < xLeft ? xLeft : xRight
    return toBox(xEdge, center.y + ((xEdge - center.x) / cosT) * sinT)
  }

  return toBox(x, yTarget)
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

const clamp = (box: Box, viewport: Size): Box => ({
  ...box,
  x: Math.max(0, Math.min(box.x, viewport.width - box.width)),
  y: Math.max(0, Math.min(box.y, viewport.height - box.height)),
})

/**
 * Picks where to draw a label so it stays inside the viewport and off its target.
 *
 * Tries the preferred side first, then the opposite side, then the two
 * perpendicular sides. Each side's box is slid back inside the viewport, and
 * the first one that doesn't cover the target wins. If every side covers the
 * target, the clamped preferred box is used.
 */
export function placeLabel({
  target,
  label,
  viewport,
  position,
  margin,
}: PlaceLabelOptions): Box {
  const preferred = toDegree(position ?? getAutoPosition(target, viewport))

  const candidates = [0, 180, 90, 270].map((offset) =>
    clamp(
      getLabelBox(target, label, (preferred + offset) % 360, margin),
      viewport,
    ),
  )

  return (
    candidates.find((box) => !overlaps(box, target)) ?? (candidates[0] as Box)
  )
}

export type TextAlign = "left" | "center" | "right"

/**
 * Aligns label text towards the target: a label left of the target aligns
 * right, a label right of it aligns left, and anything else is centered.
 */
export const getTextAlign = (target: Box, label: Box): TextAlign => {
  if (label.x + label.width <= target.x) return "right"
  if (label.x >= target.x + target.width) return "left"
  return "center"
}
