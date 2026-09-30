import { createCanvas } from "@napi-rs/canvas"
import { PNG } from "pngjs"

/** A PNG filled with one gray level, for drawing annotations onto in tests */
export const solidPng = (width: number, height: number, gray = 136) => {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`
  ctx.fillRect(0, 0, width, height)
  return canvas.toBuffer("image/png")
}

export type Rgb = [number, number, number]

/** Reads pixels back out of a PNG */
export const readPng = (buffer: Buffer) => {
  const { width, height, data } = PNG.sync.read(buffer)

  const pixel = (x: number, y: number): Rgb => {
    const i = (width * y + x) * 4
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
  }

  /** Every pixel that differs from `gray`, optionally only within a region */
  const changed = (
    gray = 136,
    region: { x1?: number; y1?: number; x2?: number; y2?: number } = {},
  ) => {
    const points: [number, number][] = []
    const { x1 = 0, y1 = 0, x2 = width, y2 = height } = region
    for (let y = y1; y < y2; y++)
      for (let x = x1; x < x2; x++) {
        const [r, g, b] = pixel(x, y)
        if (r !== gray || g !== gray || b !== gray) points.push([x, y])
      }
    return points
  }

  return { width, height, pixel, changed }
}

export const isOrange = ([r, g, b]: Rgb) =>
  r > 230 && g > 130 && g < 200 && b < 60
export const isBlue = ([r, g, b]: Rgb) => b > 200 && r < 60 && g < 60
export const isRed = ([r, g, b]: Rgb) => r > 230 && g < 40 && b < 40
export const isWhite = ([r, g, b]: Rgb) => r > 250 && g > 250 && b > 250
