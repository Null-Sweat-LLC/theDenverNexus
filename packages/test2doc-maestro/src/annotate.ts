import { fileURLToPath } from "node:url"
import {
  createCanvas,
  GlobalFonts,
  ImageData,
  type SKRSContext2D,
} from "@napi-rs/canvas"
import { PNG } from "pngjs"
import {
  type AnnotationOptions,
  FONT_FAMILY,
  scaleFont,
  withFallbackFont,
} from "./annotation.js"
import { type Box, getTextAlign, placeLabel } from "./labelPlacement.js"
import type { Highlight } from "./types.js"

// The drawing below is @test2doc/playwright's annotation rendering, which runs
// in the browser, ported to a Node canvas so both packages look alike.

const FONT_FILE = new URL(
  "../fonts/inter-latin-400-normal.woff2",
  import.meta.url,
)
let fontRegistered = false

/** Makes sure text draws the same where no fonts are installed, such as a CI container */
const registerFont = () => {
  if (fontRegistered) return
  GlobalFonts.registerFromPath(fileURLToPath(FONT_FILE), FONT_FAMILY)
  fontRegistered = true
}

// Sizes in the options are in layout units. A phone's screenshot is about
// 400 units wide, so this is how many pixels each one is worth.
const LAYOUT_WIDTH = 400

interface TextLayout {
  lines: { text: string; width: number }[]
  width: number
  height: number
  baseline: number
  lineHeight: number
}

/** Splits the text on "\n", then word wraps each line to fit `maxWidth` */
const layoutText = (
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): TextLayout => {
  const measure = (value: string) => ctx.measureText(value).width

  const lines = text.split("\n").flatMap((line) => {
    const wrapped: string[] = []
    let current = ""
    for (const word of line.split(" ")) {
      const next = current ? `${current} ${word}` : word
      if (current && measure(next) > maxWidth) {
        wrapped.push(current)
        current = word
      } else {
        current = next
      }
    }
    return [...wrapped, current]
  })

  const measured = lines.map((value) => ({
    text: value,
    width: measure(value),
  }))
  const width = Math.max(...measured.map(({ width }) => width))
  const first = ctx.measureText(lines[0] ?? "")

  // A single line hugs its glyphs, multiple lines use the font's line height
  if (lines.length === 1) {
    const ascent = first.actualBoundingBoxAscent
    const descent = first.actualBoundingBoxDescent
    return {
      lines: measured,
      width,
      height: ascent + descent,
      baseline: ascent + descent / 2,
      lineHeight: 0,
    }
  }

  const lineHeight = first.fontBoundingBoxAscent + first.fontBoundingBoxDescent
  return {
    lines: measured,
    width,
    height: lines.length * lineHeight,
    baseline: first.fontBoundingBoxAscent,
    lineHeight,
  }
}

interface Point {
  x: number
  y: number
}

/** Where a ray from `origin` first crosses the edge of a rectangle */
const rayRectIntersection = (
  origin: Point,
  direction: Point,
  rect: Box,
): Point | null => {
  const candidates: (Point & { t: number })[] = []
  const { x: rx, y: ry } = origin
  const { x: dx, y: dy } = direction

  if (dx !== 0) {
    for (const x of [rect.x, rect.x + rect.width]) {
      const t = (x - rx) / dx
      const y = ry + t * dy
      if (t > 0 && y >= rect.y && y <= rect.y + rect.height)
        candidates.push({ x, y, t })
    }
  }
  if (dy !== 0) {
    for (const y of [rect.y, rect.y + rect.height]) {
      const t = (y - ry) / dy
      const x = rx + t * dx
      if (t > 0 && x >= rect.x && x <= rect.x + rect.width)
        candidates.push({ x, y, t })
    }
  }

  const closest = candidates.reduce<(Point & { t: number }) | undefined>(
    (min, curr) => (!min || curr.t < min.t ? curr : min),
    undefined,
  )
  return closest ? { x: closest.x, y: closest.y } : null
}

const drawArrow = (
  ctx: SKRSContext2D,
  target: Box,
  labelBox: Box,
  options: AnnotationOptions,
  unit: number,
) => {
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }
  const labelCenter = {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  }
  const angle = Math.atan2(
    targetCenter.y - labelCenter.y,
    targetCenter.x - labelCenter.x,
  )
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }

  const start = rayRectIntersection(labelCenter, direction, labelBox)
  const end = rayRectIntersection(
    targetCenter,
    { x: -direction.x, y: -direction.y },
    target,
  )
  if (!start || !end) return

  const color = options.arrowStrokeStyle ?? "rgba(255, 0, 0, 1)"
  const lineWidth = (options.arrowLineWidth ?? 2) * unit

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  // The arrowhead sits on the element's edge
  const head = lineWidth * 5
  ctx.fillStyle = color
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(
    end.x - head * Math.cos(angle - Math.PI / 6),
    end.y - head * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    end.x - head * Math.cos(angle + Math.PI / 6),
    end.y - head * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

/**
 * Marks elements on a screenshot the way @test2doc/playwright does: an outline
 * and tint on each, and a label with the step's words placed clear of the
 * element, with an arrow to it if asked. `scale` converts the bounds from
 * Maestro's units to the screenshot's pixels. `defaults` style every
 * annotation, and each highlight's own options win over them.
 */
export const annotatePng = (
  image: Buffer,
  highlights: Highlight[],
  scale: number,
  defaults: AnnotationOptions,
): Buffer => {
  if (highlights.length === 0) return image
  registerFont()

  // Decode here, because a canvas image only has its pixels a tick after it is loaded
  const source = PNG.sync.read(image)
  const viewport = { width: source.width, height: source.height }
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext("2d")
  ctx.putImageData(
    new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height,
    ),
    0,
    0,
  )

  const unit = Math.max(1, viewport.width / LAYOUT_WIDTH)

  for (const highlight of highlights) {
    const options: AnnotationOptions = { ...defaults, ...highlight.options }
    const { left, top, right, bottom } = highlight.bounds
    const target: Box = {
      x: left * scale,
      y: top * scale,
      width: (right - left) * scale,
      height: (bottom - top) * scale,
    }

    // The highlight
    ctx.strokeStyle = options.highlightStrokeStyle ?? "rgba(255, 165, 0, 1)"
    ctx.lineWidth = (options.highlightLineWidth ?? 2) * unit
    ctx.strokeRect(target.x, target.y, target.width, target.height)
    ctx.fillStyle = options.highlightFillStyle ?? "rgba(255, 165, 0, 0.3)"
    ctx.fillRect(target.x, target.y, target.width, target.height)

    const text = options.text ?? highlight.text
    if (!text) continue

    // The label
    ctx.font = withFallbackFont(scaleFont(options.font ?? "14px Arial", unit))
    const maxWidth =
      options.labelMaxWidth === undefined
        ? viewport.width * 0.7
        : options.labelMaxWidth * unit
    const layout = layoutText(ctx, text, maxWidth)
    const padding = (options.labelBoxPadding ?? 4) * unit
    const labelBox = placeLabel({
      target,
      label: {
        width: layout.width + padding * 2,
        height: layout.height + padding * 2,
      },
      viewport,
      position: options.position,
      margin: (options.showArrow ? 24 : 4) * unit,
    })

    if (options.showArrow) drawArrow(ctx, target, labelBox, options, unit)

    if (options.labelBoxFillStyle || options.labelBoxStrokeStyle) {
      ctx.fillStyle = options.labelBoxFillStyle ?? "rgba(0, 0, 0, 0)"
      ctx.strokeStyle = options.labelBoxStrokeStyle ?? "rgba(0, 0, 0, 0)"
      ctx.lineWidth = (options.labelBoxLineWidth ?? 2) * unit
      ctx.fillRect(labelBox.x, labelBox.y, labelBox.width, labelBox.height)
      ctx.strokeRect(labelBox.x, labelBox.y, labelBox.width, labelBox.height)
    }

    const textAlign = options.textAlign ?? getTextAlign(target, labelBox)
    const center = {
      x: labelBox.x + labelBox.width / 2,
      y: labelBox.y + labelBox.height / 2,
    }
    const inset = (labelBox.width - layout.width) / 2
    const lines = layout.lines.map(({ text: line, width }, index) => ({
      text: line,
      x:
        textAlign === "left"
          ? labelBox.x + inset
          : textAlign === "right"
            ? labelBox.x + labelBox.width - inset - width
            : center.x - width / 2,
      y:
        center.y -
        layout.height / 2 +
        layout.baseline +
        index * layout.lineHeight,
    }))

    // Outlines first so they don't cover other lines
    ctx.strokeStyle = options.strokeStyle ?? "rgba(0, 0, 0, 0.1)"
    ctx.lineWidth = (options.lineWidth ?? 2) * unit
    for (const { text: line, x, y } of lines) ctx.strokeText(line, x, y)
    ctx.fillStyle = options.fillStyle ?? "rgba(0, 0, 0, 1)"
    for (const { text: line, x, y } of lines) ctx.fillText(line, x, y)
  }

  return canvas.toBuffer("image/png")
}
