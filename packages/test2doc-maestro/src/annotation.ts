import type { Position } from "./labelPlacement.js"

/**
 * The same options as @test2doc/playwright's annotations, except that sizes
 * are in layout units (like CSS px) and scale with the screenshot, so one
 * style suits a 500px wide web screenshot and a 1206px wide iOS one.
 */
export interface AnnotationOptions {
  text?: string // Text to display for label, "\n" starts a new line. Defaults to the step's words
  labelMaxWidth?: number // Wrap label text onto new lines past this width
  textAlign?: "left" | "center" | "right" // Alignment of multi-line label text, defaults to the side facing the element
  fillStyle?: string // Label text color
  font?: string // Font size and family
  strokeStyle?: string // Label text outline color
  lineWidth?: number // Label text outline width
  labelBoxFillStyle?: string // Label background color
  labelBoxStrokeStyle?: string // Label border color
  labelBoxLineWidth?: number // Label border width
  labelBoxPadding?: number // Space between the label text and the label border
  highlightFillStyle?: string // Highlight background
  highlightStrokeStyle?: string // Highlight border
  highlightLineWidth?: number // Highlight border width
  position?: Position // Position of the label relative to the element
  showArrow?: boolean // Whether to show an arrow pointing to the element
  arrowStrokeStyle?: string // Color of the arrow
  arrowLineWidth?: number // Width of the arrow line
}

/** The family of the font bundled with the package, used where others are missing */
export const FONT_FAMILY = "Test2Doc Sans"

type Kind = "string" | "number" | "boolean" | "textAlign" | "position"

const KINDS: Record<keyof AnnotationOptions, Kind> = {
  text: "string",
  labelMaxWidth: "number",
  textAlign: "textAlign",
  fillStyle: "string",
  font: "string",
  strokeStyle: "string",
  lineWidth: "number",
  labelBoxFillStyle: "string",
  labelBoxStrokeStyle: "string",
  labelBoxLineWidth: "number",
  labelBoxPadding: "number",
  highlightFillStyle: "string",
  highlightStrokeStyle: "string",
  highlightLineWidth: "number",
  position: "position",
  showArrow: "boolean",
  arrowStrokeStyle: "string",
  arrowLineWidth: "number",
}

const isValid = (kind: Kind, value: unknown) => {
  switch (kind) {
    case "string":
      return typeof value === "string"
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return typeof value === "number" && Number.isFinite(value) && value >= 0
    case "textAlign":
      return value === "left" || value === "center" || value === "right"
    case "position":
      return (
        typeof value === "number" ||
        value === "above" ||
        value === "below" ||
        value === "left" ||
        value === "right"
      )
  }
}

const EXPECTED: Record<Kind, string> = {
  string: "a string",
  number: "a number of 0 or more",
  boolean: "true or false",
  textAlign: '"left", "center" or "right"',
  position: '"above", "below", "left", "right" or a number of degrees',
}

/** Checks options from a config file or a label, so a typo fails loudly. */
export const validateAnnotationOptions = (
  value: unknown,
  source: string,
): AnnotationOptions => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `Invalid annotation options in ${source}: expected an object`,
    )
  }

  for (const [key, option] of Object.entries(value)) {
    const kind = KINDS[key as keyof AnnotationOptions]
    if (!kind) {
      throw new Error(
        `Unknown annotation option "${key}" in ${source}. Known options: ${Object.keys(KINDS).join(", ")}`,
      )
    }
    if (!isValid(kind, option)) {
      throw new Error(
        `Invalid annotation option "${key}" in ${source}: expected ${EXPECTED[kind]}`,
      )
    }
  }

  return value as AnnotationOptions
}

/** A step's words as plain text, for drawing on an image */
export const plainText = (markdown: string) =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, "$1")
    .replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")

const SUFFIX = /\s*\[test2doc_annotation\]:(.*)$/s

/**
 * Splits a step's label into its words and the annotation options written
 * after them, like `Tap it [test2doc_annotation]:{"position":"below"}`.
 */
export const parseAnnotationLabel = (
  label: string,
): { text: string; options?: AnnotationOptions } => {
  const match = label.match(SUFFIX)
  if (!match) return { text: label }

  const text = label.slice(0, match.index).trimEnd()
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1] ?? "")
  } catch {
    throw new Error(
      `Invalid annotation options in the label "${text}": not valid JSON`,
    )
  }

  return {
    text,
    options: validateAnnotationOptions(parsed, `the label "${text}"`),
  }
}

/** Scales the px size in a font, which is in layout units, to the screenshot's pixels */
export const scaleFont = (font: string, unit: number) =>
  font.replace(
    /(\d+(?:\.\d+)?)px/,
    (_, size: string) => `${Math.round(Number(size) * unit * 10) / 10}px`,
  )

/** Lets the bundled font stand in where the one asked for is not installed */
export const withFallbackFont = (font: string) => `${font}, "${FONT_FAMILY}"`
