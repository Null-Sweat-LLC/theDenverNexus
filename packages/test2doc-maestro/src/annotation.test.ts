import { describe, expect, it } from "vitest"
import {
  parseAnnotationLabel,
  plainText,
  scaleFont,
  validateAnnotationOptions,
  withFallbackFont,
} from "./annotation.js"

describe("plainText", () => {
  it("drops the markdown around a step's words", () => {
    expect(plainText("Press **Enter** on the keyboard.")).toBe(
      "Press Enter on the keyboard.",
    )
    expect(plainText("Tap `Add` or _Done_ or *Save*")).toBe(
      "Tap Add or Done or Save",
    )
    expect(plainText("See [the docs](https://example.com) now")).toBe(
      "See the docs now",
    )
  })

  it("leaves ordinary text alone", () => {
    expect(plainText("Tap the text field.")).toBe("Tap the text field.")
    expect(plainText("snake_case_name")).toBe("snake_case_name")
  })
})

describe("parseAnnotationLabel", () => {
  it("returns a plain label as is", () => {
    expect(parseAnnotationLabel("Tap the field.")).toEqual({
      text: "Tap the field.",
    })
  })

  it("splits off the options in a [test2doc_annotation] suffix", () => {
    const parsed = parseAnnotationLabel(
      'Tap the field. [test2doc_annotation]:{"position":"below","showArrow":true}',
    )

    expect(parsed).toEqual({
      text: "Tap the field.",
      options: { position: "below", showArrow: true },
    })
  })

  it("can override the annotation's text", () => {
    expect(
      parseAnnotationLabel('Tap it [test2doc_annotation]:{"text":"Here"}')
        .options,
    ).toEqual({
      text: "Here",
    })
  })

  it("fails on options that are not valid JSON, naming the label", () => {
    expect(() =>
      parseAnnotationLabel("Tap it [test2doc_annotation]:{nope}"),
    ).toThrow(/Tap it.*JSON|JSON.*Tap it/s)
  })

  it("fails on options that are not an object", () => {
    expect(() =>
      parseAnnotationLabel("Tap it [test2doc_annotation]:[1]"),
    ).toThrow(/object/)
  })

  it("fails on an unknown option, like a typo", () => {
    expect(() =>
      parseAnnotationLabel(
        'Tap it [test2doc_annotation]:{"hightlightFillStyle":"red"}',
      ),
    ).toThrow(/hightlightFillStyle/)
  })
})

describe("validateAnnotationOptions", () => {
  it("accepts every option the Playwright package has", () => {
    const options = {
      text: "a",
      labelMaxWidth: 200,
      textAlign: "left",
      fillStyle: "red",
      font: "14px Arial",
      strokeStyle: "red",
      lineWidth: 2,
      labelBoxFillStyle: "white",
      labelBoxStrokeStyle: "black",
      labelBoxLineWidth: 1,
      labelBoxPadding: 6,
      highlightFillStyle: "rgba(0,0,0,.1)",
      highlightStrokeStyle: "blue",
      highlightLineWidth: 3,
      position: "above",
      showArrow: true,
      arrowStrokeStyle: "red",
      arrowLineWidth: 3,
    }

    expect(validateAnnotationOptions(options, "test")).toEqual(options)
  })

  it.each([
    [{ position: 45 }],
    [{ position: "below" }],
    [{ textAlign: "center" }],
  ])("accepts %j", (options) => {
    expect(validateAnnotationOptions(options, "test")).toEqual(options)
  })

  it.each([
    [{ lineWidth: "2" }, /lineWidth/],
    [{ showArrow: "yes" }, /showArrow/],
    [{ textAlign: "middle" }, /textAlign/],
    [{ position: "sideways" }, /position/],
    [{ labelBoxPadding: -1 }, /labelBoxPadding/],
    [{ fillStyle: 3 }, /fillStyle/],
  ])("rejects %j", (options, message) => {
    expect(() => validateAnnotationOptions(options, "my config")).toThrow(
      message,
    )
  })

  it("says where the bad option came from", () => {
    expect(() => validateAnnotationOptions({ nope: 1 }, "my config")).toThrow(
      /my config/,
    )
  })
})

describe("scaleFont", () => {
  it("scales the size, which is in layout units", () => {
    expect(scaleFont("14px Arial", 2)).toBe("28px Arial")
    expect(scaleFont("bold 16px Georgia, serif", 2.5)).toBe(
      "bold 40px Georgia, serif",
    )
  })

  it("keeps a unitless line height", () => {
    expect(scaleFont("12px/1.5 Arial", 2)).toBe("24px/1.5 Arial")
  })

  it("leaves a font without a px size as it is", () => {
    expect(scaleFont("large Arial", 2)).toBe("large Arial")
  })
})

describe("withFallbackFont", () => {
  it("adds the bundled font so text still draws where the font is missing", () => {
    expect(withFallbackFont("14px Arial")).toBe('14px Arial, "Test2Doc Sans"')
  })
})
