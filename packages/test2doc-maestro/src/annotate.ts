import { PNG } from "pngjs"
import type { Highlight } from "./types.js"

type Rgb = [number, number, number]

const ACCENT: Rgb = [255, 90, 31]
const WHITE: Rgb = [255, 255, 255]
const FILL_ALPHA = 0.12

// 3x5 pixel digits, one string of 15 cells per digit, row by row
const DIGITS: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001001001001",
  "8": "111101111101111",
  "9": "111101111001111",
}

const blend = (png: PNG, x: number, y: number, [r, g, b]: Rgb, alpha = 1) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return
  const i = (png.width * y + x) * 4
  for (const [offset, value] of [r, g, b].entries()) {
    const at = i + offset
    png.data[at] = Math.round((png.data[at] ?? 0) * (1 - alpha) + value * alpha)
  }
}

const fillRect = (
  png: PNG,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: Rgb,
  alpha = 1,
) => {
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) blend(png, x, y, color, alpha)
}

const strokeRect = (
  png: PNG,
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
) => {
  fillRect(png, left, top, right, top + width, ACCENT)
  fillRect(png, left, bottom - width, right, bottom, ACCENT)
  fillRect(png, left, top, left + width, bottom, ACCENT)
  fillRect(png, right - width, top, right, bottom, ACCENT)
}

const fillCircle = (
  png: PNG,
  cx: number,
  cy: number,
  radius: number,
  color: Rgb,
) => {
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blend(png, x, y, color)
}

const drawNumber = (
  png: PNG,
  text: string,
  cx: number,
  cy: number,
  cell: number,
) => {
  const width = text.length * 4 * cell - cell
  const height = 5 * cell
  let x0 = Math.round(cx - width / 2)
  const y0 = Math.round(cy - height / 2)
  for (const char of text) {
    const glyph = DIGITS[char] ?? ""
    for (let i = 0; i < glyph.length; i++) {
      if (glyph[i] === "1") {
        const gx = x0 + (i % 3) * cell
        const gy = y0 + Math.floor(i / 3) * cell
        fillRect(png, gx, gy, gx + cell, gy + cell, WHITE)
      }
    }
    x0 += 4 * cell
  }
}

/**
 * Marks elements on a screenshot: an outline and light tint around each, and a
 * badge with the step's number at its top left corner. `scale` converts the
 * bounds from Maestro's units to the screenshot's pixels.
 */
export const annotatePng = (
  image: Buffer,
  highlights: Highlight[],
  scale: number,
): Buffer => {
  if (highlights.length === 0) return image

  const png = PNG.sync.read(image)
  const stroke = Math.max(3, Math.round(png.width / 200))
  const pad = stroke * 2
  const cell = Math.max(3, Math.round(png.width / 200))
  const radius = Math.ceil(cell * 4.5)

  for (const { bounds, step } of highlights) {
    const left = Math.round(bounds.left * scale) - pad
    const top = Math.round(bounds.top * scale) - pad
    const right = Math.round(bounds.right * scale) + pad
    const bottom = Math.round(bounds.bottom * scale) + pad

    fillRect(png, left, top, right, bottom, ACCENT, FILL_ALPHA)
    strokeRect(png, left, top, right, bottom, stroke)

    const digits = String(step).length
    const cx = Math.min(Math.max(left, radius), png.width - radius - 1)
    // Sit above the corner so a small element's own label stays readable
    const cy = Math.min(
      Math.max(top - Math.round(radius / 2), radius),
      png.height - radius - 1,
    )
    fillCircle(png, cx, cy, radius + Math.max(0, digits - 1) * cell, ACCENT)
    drawNumber(png, String(step), cx, cy, cell)
  }

  return PNG.sync.write(png)
}
