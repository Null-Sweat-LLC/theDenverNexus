import { readFileSync } from "node:fs"
import {
  type AnnotationOptions,
  validateAnnotationOptions,
} from "./annotation.js"

export interface Config {
  /** Styling for every annotation, which a step's own options override */
  annotationDefaults: AnnotationOptions
  /**
   * Keep a screenshot with a fixed file name that's already in the output when
   * no more than this share of its pixels (0-1) changed
   */
  maxDiffPixelRatio?: number
}

const KEYS = ["annotationDefaults", "maxDiffPixelRatio"]

/** Reads a test2doc-maestro config file, which is JSON. */
export const loadConfig = (file: string): Config => {
  let raw: string
  try {
    raw = readFileSync(file, "utf8")
  } catch {
    throw new Error(`Cannot read the config file ${file}`)
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error(`The config file ${file} is not valid JSON`)
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`The config file ${file} must contain an object`)
  }

  for (const key of Object.keys(json)) {
    if (!KEYS.includes(key)) {
      throw new Error(
        `Unknown key "${key}" in the config file ${file}. Known keys: ${KEYS.join(", ")}`,
      )
    }
  }

  const { annotationDefaults, maxDiffPixelRatio } = json as {
    annotationDefaults?: unknown
    maxDiffPixelRatio?: unknown
  }
  if (
    maxDiffPixelRatio !== undefined &&
    (typeof maxDiffPixelRatio !== "number" ||
      !(maxDiffPixelRatio >= 0 && maxDiffPixelRatio <= 1))
  ) {
    throw new Error(
      `Invalid maxDiffPixelRatio in the config file ${file}: expected a number from 0 to 1`,
    )
  }

  return {
    ...(maxDiffPixelRatio === undefined ? {} : { maxDiffPixelRatio }),
    annotationDefaults:
      annotationDefaults === undefined
        ? {}
        : validateAnnotationOptions(
            annotationDefaults,
            `the config file ${file}`,
          ),
  }
}
