import type {
  Locator,
  Page,
  PageScreenshotOptions,
  TestInfo,
} from "@playwright/test"
import {
  type Box,
  getTextAlign,
  type Position,
  placeLabel,
  type TextAlign,
} from "./labelPlacement.js"

let screenshotCounter = 0

const getLabelPadding = (annotation: AnnotationOptions) =>
  annotation.labelBoxPadding ?? 4

const getLabelMargin = (annotation: AnnotationOptions) =>
  annotation.showArrow ? 24 : 4

export interface AnnotationOptions {
  text?: string // Text to display for label, "\n" starts a new line
  labelMaxWidth?: number // Wrap label text onto new lines past this width in pixels
  textAlign?: TextAlign // Alignment of multi-line label text, defaults to the side facing the element
  fillStyle?: string // Label text color
  font?: string // Font size and family
  strokeStyle?: string // Label outline color
  lineWidth?: number // Label outline width
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
  altText?: string // Alt text for the screenshot image
  figure?: boolean // Whether to wrap screenshot in a figure element
  caption?: string // Caption text for figcaption (defaults to annotation text if not provided)
  filename?: string // Fixed file name for the screenshot in the generated docs, instead of a content hash
}

interface ScreenshotOptions extends PageScreenshotOptions {
  annotation?: AnnotationOptions
}

interface MultiLocatorScreenshot {
  target: Locator
  options?: ScreenshotOptions
}

const getFilename = (filename: string): string => {
  if (!filename || /[/\\]/.test(filename)) {
    throw new Error(
      `Invalid screenshot filename "${filename}": it must be a non-empty name without path separators`,
    )
  }
  return filename.endsWith(".png") ? filename : `${filename}.png`
}

const getMetadataSuffix = (annotation: AnnotationOptions): string => {
  if (annotation.figure) {
    return `[test2doc_screenshot]:${JSON.stringify({
      figure: true,
      ...(annotation.caption && { caption: annotation.caption }),
      ...(annotation.filename && {
        filename: getFilename(annotation.filename),
      }),
    })}`
  }
  if (annotation.filename) {
    return `[test2doc_screenshot]:${JSON.stringify({
      ...(annotation.altText && { caption: annotation.altText }),
      filename: getFilename(annotation.filename),
    })}`
  }
  if (annotation.altText) {
    return `:${annotation.altText}`
  }
  return ""
}

/**
 * Takes a screenshot of the specified target element(s) and attaches it to the test report.
 * @param testInfo [The TestInfo object](https://playwright.dev/docs/api/class-testinfo) supplied from the test block, it is the second argument to the test function.
 * @param target A [Page](https://playwright.dev/docs/api/class-page), [Locator](https://playwright.dev/docs/locators), or [Array of MultiLocatorScreenshot](https://www.test2doc.com/docs/user-guide/screenshots/#highlight-multiple-elements) options.
 * @param screenshotOptions Screenshot options using [Playwright's PageScreenshotOptions](https://playwright.dev/docs/api/class-page#page-screenshot) and/or [Test2Doc's AnnotationOptions](https://www.test2doc.com/docs/user-guide/screenshots/annotation) for annotation highlighting.
 * @returns {Promise<void>} A Promise that resolves when the screenshot is taken and attached to the test report.
 * @example
 * // Single element with annotation
 * screenshot(testInfo, page.getByRole("button", { name: "CTA" }), { annotation: { text: "Call to action" } });
 * @example
 * // Multiple elements with individual annotations
 * screenshot(testInfo, [
 *   { target: page.getByRole("button", { name: "CTA" }), options: { annotation: { text: "Call to action" } } },
 *   { target: page.getByRole("heading", { name: "Welcome" }), options: { annotation: { text: "Main heading", position: "above" } } }
 * ]);
 */
export const screenshot = async (
  testInfo: TestInfo,
  target: Page | Locator | MultiLocatorScreenshot[],
  { annotation: overrideAnnotations, ...options }: ScreenshotOptions = {},
): Promise<void> => {
  const annotation: AnnotationOptions = {
    ...(testInfo.project?.use?.test2doc?.annotationDefaults ?? {}),
    ...overrideAnnotations,
  }

  const filename = `test2doc-${Date.now()}-${++screenshotCounter}.png${getMetadataSuffix(annotation)}`

  const screenshotBuffer: Buffer =
    "highlight" in target || Array.isArray(target)
      ? await generateScreenshotBuffer(
          Array.isArray(target) ? target : [{ target }],
          options,
          annotation,
        )
      : await target.screenshot(options)

  await testInfo.attach(filename, {
    body: screenshotBuffer,
    contentType: "image/png",
  })
}

async function generateScreenshotBuffer(
  targets: MultiLocatorScreenshot[],
  options: ScreenshotOptions,
  annotation: AnnotationOptions,
): Promise<Buffer> {
  const firstTarget = targets.at(0)?.target
  if (!firstTarget) throw new Error("No targets provided for screenshot")

  const page = firstTarget.page()
  await firstTarget.scrollIntoViewIfNeeded()

  const boundingBoxes = await Promise.all(
    targets.map(({ target }) => target.boundingBox()),
  )
  const annotations = targets.map(({ options }) => ({
    ...annotation,
    ...options?.annotation,
  }))

  if (boundingBoxes) {
    // Split and measure label text in the page, since it depends on the page's fonts
    const { viewport, textMetrics } = await page.evaluate((annotations) => {
      const ctx = document.createElement("canvas").getContext("2d")
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        textMetrics: annotations.map((annotation) => {
          if (!ctx || !annotation.text) return null
          ctx.font = annotation.font ?? "14px Arial"
          const measure = (text: string) => ctx.measureText(text).width
          const maxWidth = annotation.labelMaxWidth

          // Break on "\n", then word wrap each line to fit labelMaxWidth
          const lines = annotation.text.split("\n").flatMap((line) => {
            if (!maxWidth) return [line]
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

          const measured = lines.map((text) => ({ text, width: measure(text) }))
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

          const lineHeight =
            first.fontBoundingBoxAscent + first.fontBoundingBoxDescent
          return {
            lines: measured,
            width,
            height: lines.length * lineHeight,
            baseline: first.fontBoundingBoxAscent,
            lineHeight,
          }
        }),
      }
    }, annotations)

    const labelBoxes = boundingBoxes.map((box, index): Box | null => {
      const metrics = textMetrics[index]
      const annotation = annotations[index]
      if (!box || !metrics || !annotation) return null
      return placeLabel({
        target: box,
        label: {
          width: metrics.width + getLabelPadding(annotation) * 2,
          height: metrics.height + getLabelPadding(annotation) * 2,
        },
        viewport,
        position: annotation.position,
        margin: getLabelMargin(annotation),
      })
    })

    const textAligns = boundingBoxes.map((box, index) => {
      const labelBox = labelBoxes[index]
      if (!box || !labelBox) return "center"
      return annotations[index]?.textAlign ?? getTextAlign(box, labelBox)
    })

    await page.evaluate(
      ({
        boundingBoxes: boxes,
        annotations,
        labelBoxes,
        textMetrics,
        textAligns,
      }) => {
        const canvas = document.createElement("canvas")
        canvas.id = "test2doc-highlight-canvas"
        canvas.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          `

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const ctx = canvas.getContext("2d")
        if (ctx) {
          for (const [index, box] of boxes.entries()) {
            if (!box) continue
            const annotation = annotations[index]
            // Draw highlight rectangle
            ctx.strokeStyle =
              annotation?.highlightStrokeStyle ?? "rgba(255, 165, 0, 1)"
            ctx.lineWidth = annotation?.highlightLineWidth ?? 2
            ctx.strokeRect(box.x, box.y, box.width, box.height)

            // Add subtle fill
            ctx.fillStyle =
              annotation?.highlightFillStyle ?? "rgba(255, 165, 0, 0.3)"
            ctx.fillRect(box.x, box.y, box.width, box.height)

            if (annotation?.text) {
              ctx.font = annotation?.font ?? "14px Arial"
              const labelBox = labelBoxes[index]
              const metrics = textMetrics[index]
              if (!labelBox || !metrics) continue
              const centerBox = {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
              }
              const labelPosition = {
                x: labelBox.x + labelBox.width / 2,
                y: labelBox.y + labelBox.height / 2,
              }

              // Render arrow if enabled
              if (annotation.showArrow) {
                const arrowColor =
                  annotation.arrowStrokeStyle ?? "rgba(255, 0, 0, 1)"

                // Calculate the angle from label center to box center
                const dx = centerBox.x - labelPosition.x
                const dy = centerBox.y - labelPosition.y
                const angle = Math.atan2(dy, dx)

                // Function to find intersection of ray with rectangle
                function getRayRectIntersection(
                  rayX: number,
                  rayY: number, // Ray origin
                  rayDx: number,
                  rayDy: number, // Ray direction (normalized)
                  rectX: number,
                  rectY: number, // Rectangle position
                  rectW: number,
                  rectH: number, // Rectangle size
                ) {
                  const candidates = []

                  // Check intersection with each side of the rectangle
                  // Left side
                  if (rayDx !== 0) {
                    const t = (rectX - rayX) / rayDx
                    const y = rayY + t * rayDy
                    if (t > 0 && y >= rectY && y <= rectY + rectH) {
                      candidates.push({ x: rectX, y, t })
                    }
                  }

                  // Right side
                  if (rayDx !== 0) {
                    const t = (rectX + rectW - rayX) / rayDx
                    const y = rayY + t * rayDy
                    if (t > 0 && y >= rectY && y <= rectY + rectH) {
                      candidates.push({ x: rectX + rectW, y, t })
                    }
                  }

                  // Top side
                  if (rayDy !== 0) {
                    const t = (rectY - rayY) / rayDy
                    const x = rayX + t * rayDx
                    if (t > 0 && x >= rectX && x <= rectX + rectW) {
                      candidates.push({ x, y: rectY, t })
                    }
                  }

                  // Bottom side
                  if (rayDy !== 0) {
                    const t = (rectY + rectH - rayY) / rayDy
                    const x = rayX + t * rayDx
                    if (t > 0 && x >= rectX && x <= rectX + rectW) {
                      candidates.push({ x, y: rectY + rectH, t })
                    }
                  }

                  // Return the closest intersection
                  if (candidates.length === 0) return null
                  const closest = candidates.reduce((min, curr) =>
                    curr.t < min.t ? curr : min,
                  )
                  return { x: closest.x, y: closest.y }
                }

                // Calculate arrow start (edge of label box)
                const rayDx = Math.cos(angle)
                const rayDy = Math.sin(angle)

                const arrowStart = getRayRectIntersection(
                  labelPosition.x,
                  labelPosition.y, // From label center
                  rayDx,
                  rayDy, // Towards box center
                  labelBox.x,
                  labelBox.y,
                  labelBox.width,
                  labelBox.height,
                )

                // Calculate arrow end (edge of highlight box)
                const arrowEnd = getRayRectIntersection(
                  centerBox.x,
                  centerBox.y, // From box center
                  -rayDx,
                  -rayDy, // Towards label center (opposite direction)
                  box.x,
                  box.y,
                  box.width,
                  box.height,
                )

                if (arrowStart && arrowEnd) {
                  // Draw the arrow line
                  ctx.strokeStyle = arrowColor
                  ctx.lineWidth = annotation.arrowLineWidth ?? 2
                  ctx.beginPath()
                  ctx.moveTo(arrowStart.x, arrowStart.y)
                  ctx.lineTo(arrowEnd.x, arrowEnd.y)
                  ctx.stroke()

                  // Draw arrowhead at the highlight box edge
                  const headLength = (annotation.arrowLineWidth ?? 2) * 5
                  ctx.fillStyle = arrowColor
                  ctx.lineJoin = "round"
                  ctx.lineCap = "round"
                  ctx.beginPath()
                  ctx.moveTo(arrowEnd.x, arrowEnd.y)
                  ctx.lineTo(
                    arrowEnd.x - headLength * Math.cos(angle - Math.PI / 6),
                    arrowEnd.y - headLength * Math.sin(angle - Math.PI / 6),
                  )
                  ctx.lineTo(
                    arrowEnd.x - headLength * Math.cos(angle + Math.PI / 6),
                    arrowEnd.y - headLength * Math.sin(angle + Math.PI / 6),
                  )
                  ctx.closePath()
                  ctx.fill()
                  ctx.stroke()
                }

                ctx.resetTransform()
              }

              // Draw label box
              if (
                annotation.labelBoxFillStyle ||
                annotation.labelBoxStrokeStyle
              ) {
                ctx.fillStyle =
                  annotation.labelBoxFillStyle ?? "rgba(0, 0, 0, 0)"
                ctx.strokeStyle =
                  annotation.labelBoxStrokeStyle ?? "rgba(0, 0, 0, 0)"
                ctx.lineWidth = annotation.labelBoxLineWidth ?? 2
                ctx.fillRect(
                  labelBox.x,
                  labelBox.y,
                  labelBox.width,
                  labelBox.height,
                )
                ctx.strokeRect(
                  labelBox.x,
                  labelBox.y,
                  labelBox.width,
                  labelBox.height,
                )
              }
              const textAlign = textAligns[index]
              const padding = (labelBox.width - metrics.width) / 2
              const lines = metrics.lines.map(({ text, width }, line) => ({
                text,
                x:
                  textAlign === "left"
                    ? labelBox.x + padding
                    : textAlign === "right"
                      ? labelBox.x + labelBox.width - padding - width
                      : labelPosition.x - width / 2,
                y:
                  labelPosition.y -
                  metrics.height / 2 +
                  metrics.baseline +
                  line * metrics.lineHeight,
              }))

              // Draw label text, outlines first so they don't cover other lines
              ctx.strokeStyle = annotation?.strokeStyle ?? "rgba(0, 0, 0, 0.1)"
              ctx.lineWidth = annotation?.lineWidth ?? 2
              for (const { text, x, y } of lines) ctx.strokeText(text, x, y)
              ctx.fillStyle = annotation?.fillStyle ?? "rgba(0, 0, 0, 1)"
              for (const { text, x, y } of lines) ctx.fillText(text, x, y)
            }
          }
        }

        // dialogs opened with showModal() live in the browser top layer, which
        // renders above all z-index stacking — appending to body means the
        // canvas is always hidden behind an open dialog. Append to the dialog
        // instead so the canvas inherits its top-layer position.
        const topLevelContainer =
          document.querySelector("dialog[open]") ?? document.body
        topLevelContainer.appendChild(canvas)
      },
      {
        boundingBoxes,
        annotations,
        labelBoxes,
        textMetrics,
        textAligns,
      },
    )

    const screenshotBuffer = await page.screenshot(options)

    // Clean up canvas
    await page.evaluate(() => {
      const canvas = document.getElementById("test2doc-highlight-canvas")
      if (canvas) canvas.remove()
    })

    return screenshotBuffer
  }

  return await page.screenshot(options)
}
