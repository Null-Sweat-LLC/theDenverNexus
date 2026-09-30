import type { Bounds, CommandEntry } from "./types.js"

export interface Tap {
  bounds: Bounds
  attrs: Record<string, string>
  /** iOS reports bounds in points, so they need scaling to the screenshot's pixels */
  ios: boolean
}

const TAP_LINE = "Tapping on element:"
const ATTRIBUTES = /attributes=\{(.*?)\}, children=/
const BOUNDS = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/

const parseAttrs = (text: string) => {
  const attrs: Record<string, string> = {}
  for (const pair of text.split(/, (?=[A-Za-z][\w-]*=)/)) {
    const at = pair.indexOf("=")
    if (at > 0) attrs[pair.slice(0, at)] = pair.slice(at + 1)
  }
  return attrs
}

/**
 * Reads the elements Maestro tapped from its log. Only taps log the matched
 * element's bounds, so that is all the log can tell us about.
 */
export const parseTaps = (log: string): Tap[] => {
  const taps: Tap[] = []
  for (const line of log.split("\n")) {
    if (!line.includes(TAP_LINE)) continue
    const attrs = parseAttrs(line.match(ATTRIBUTES)?.[1] ?? "")
    const [, left, top, right, bottom] = attrs["bounds"]?.match(BOUNDS) ?? []
    if (!left || !top || !right || !bottom) continue
    taps.push({
      bounds: { left: +left, top: +top, right: +right, bottom: +bottom },
      attrs,
      ios: "title" in attrs,
    })
  }
  return taps
}

const fullMatch = (pattern: string, value: string | undefined) => {
  if (value === undefined) return false
  try {
    return new RegExp(`^(?:${pattern})$`, "s").test(value)
  } catch {
    return false
  }
}

const fits = (selector: { idRegex?: string; textRegex?: string }, tap: Tap) => {
  const { idRegex, textRegex } = selector
  if (!idRegex && !textRegex) return false
  if (idRegex && !fullMatch(idRegex, tap.attrs["resource-id"])) return false
  if (
    textRegex &&
    ![
      tap.attrs["text"],
      tap.attrs["hintText"],
      tap.attrs["accessibilityText"],
    ].some((value) => fullMatch(textRegex, value))
  ) {
    return false
  }
  return true
}

/**
 * Pairs each completed tap command with the logged tap that fits its selector,
 * working through both in order. A logged tap that fits no command, such as a
 * retry, is skipped. Returns the tapped bounds by the command's sequence number.
 */
export const matchTaps = (entries: CommandEntry[], taps: Tap[]) => {
  const matched = new Map<number, Bounds>()
  const ordered = [...entries].sort(
    (a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber,
  )
  let next = 0

  for (const entry of ordered) {
    const selector = entry.command["tapOnElement"]?.selector
    if (!selector || entry.metadata.status !== "COMPLETED") continue

    for (let i = next; i < taps.length; i++) {
      const tap = taps[i]
      if (tap && fits(selector, tap)) {
        matched.set(entry.metadata.sequenceNumber, tap.bounds)
        next = i + 1
        break
      }
    }
  }

  return matched
}

// Logical widths, in points, of the iPhones and iPads that report in points
const PHONE_POINTS = [300, 450]
const TABLET_POINTS = [700, 1100]

const inRange = (width: number, [low, high]: number[]) =>
  Number.isInteger(width) && width >= (low ?? 0) && width <= (high ?? 0)

/**
 * How many screenshot pixels make up one unit of Maestro's bounds. Android and
 * web report pixels (1). iOS reports points, so work the scale out from the
 * screenshot's width, unless it was given. Returns undefined if it cannot tell.
 */
export const detectScale = (
  taps: Tap[],
  pixelWidth: number,
  explicit?: number,
): number | undefined => {
  if (explicit) return explicit
  if (!taps.some((tap) => tap.ios)) return 1

  return [3, 2].find((scale) => {
    const points = pixelWidth / scale
    return inRange(points, PHONE_POINTS) || inRange(points, TABLET_POINTS)
  })
}
