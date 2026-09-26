import type {
  Locator,
  Page,
  PageScreenshotOptions,
  TestInfo,
} from "@playwright/test"
import { type Box, type Position, placeLabel } from "./labelPlacement.js"

let screenshotCounter = 0

const LABEL_PADDING = 4

const getLabelMargin = (annotation: AnnotationOptions) =>
  annotation.showArrow ? 24 : 4

export interface AnnotationOptions {
  text?: string // Text to display for label
  fillStyle?: string // Label text color
  font?: string // Font size and family
  strokeStyle?: string // Label outline color
  lineWidth?: number // Label outline width
  labelBoxFillStyle?: string // Label background color
  labelBoxStrokeStyle?: string // Label border color
  labelBoxLineWidth?: number // Label border width
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
}

interface ScreenshotOptions extends PageScreenshotOptions {
  annotation?: AnnotationOptions
}

interface MultiLocatorScreenshot {
  target: Locator
  options?: ScreenshotOptions
}

const getMetadataSuffix = (annotation: AnnotationOptions): string => {
  if (annotation.figure) {
    return `[test2doc_screenshot]:${JSON.stringify({
      figure: true,
      ...(annotation.caption && { caption: annotation.caption }),
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
    // Measure label text in the page, since it depends on the page's fonts
    const { viewport, textMetrics } = await page.evaluate((annotations) => {
      const ctx = document.createElement("canvas").getContext("2d")
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        textMetrics: annotations.map((annotation) => {
          if (!ctx || !annotation.text) return null
          ctx.font = annotation.font ?? "14px Arial"
          const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } =
            ctx.measureText(annotation.text)
          return { width, actualBoundingBoxAscent, actualBoundingBoxDescent }
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
          width: metrics.width + LABEL_PADDING * 2,
          height:
            metrics.actualBoundingBoxAscent +
            metrics.actualBoundingBoxDescent +
            LABEL_PADDING * 2,
        },
        viewport,
        position: annotation.position,
        margin: getLabelMargin(annotation),
      })
    })

    await page.evaluate(
      ({ boundingBoxes: boxes, annotations, labelBoxes }) => {
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
              const {
                width: textWidth,
                actualBoundingBoxAscent,
                actualBoundingBoxDescent,
              } = ctx.measureText(annotation.text)
              const textHeight =
                actualBoundingBoxAscent + actualBoundingBoxDescent
              const labelBox = labelBoxes[index]
              if (!labelBox) continue
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
              const labelX = labelPosition.x - textWidth / 2
              const labelY =
                labelPosition.y +
                actualBoundingBoxAscent -
                textHeight / 2 +
                actualBoundingBoxDescent / 2

              // Draw label text
              ctx.strokeStyle = annotation?.strokeStyle ?? "rgba(0, 0, 0, 0.1)"
              ctx.lineWidth = annotation?.lineWidth ?? 2
              ctx.strokeText(annotation.text, labelX, labelY)
              ctx.fillStyle = annotation?.fillStyle ?? "rgba(0, 0, 0, 1)"
              ctx.fillText(annotation.text, labelX, labelY)
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
      { boundingBoxes, annotations, labelBoxes },
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
