import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

export const convertToKebabCase = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * Share of pixels (0-1) that differ between two PNGs. Images of different
 * sizes, or that can't be read, count as entirely different (Infinity).
 */
export const changedPixelRatio = (a: Buffer, b: Buffer): number => {
  try {
    const pngA = PNG.sync.read(a)
    const pngB = PNG.sync.read(b)
    if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
      return Number.POSITIVE_INFINITY
    }
    const changed = pixelmatch(
      pngA.data,
      pngB.data,
      undefined,
      pngA.width,
      pngA.height,
    )
    return changed / (pngA.width * pngA.height)
  } catch {
    return Number.POSITIVE_INFINITY
  }
}
