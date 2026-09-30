# @test2doc/maestro

Generate Docusaurus docs from [Maestro](https://maestro.dev) flow runs.

Maestro has no reporter API, so this is a CLI that reads the artifacts of a
finished run (`--test-output-dir`) and writes the docs.

## Usage

```bash
maestro test -e TEST2DOC=true --test-output-dir maestro-output .maestro
test2doc-maestro --input maestro-output --output docs
```

| Option | Description |
| --- | --- |
| `-i, --input <[platform[@scale]=]dir>` | The directory passed to `--test-output-dir` (required). Repeat it with a platform for each to document several platforms, and add `@scale` for iOS if needed. |
| `-o, --output <dir>` | Where to write the docs (default `./docs`) |

## Writing flows for docs

The page reads like a how-to guide, built from the `label:`s in your flow. The
flow's `name:` is the page title.

| In the flow | In the docs |
| --- | --- |
| `runFlow` with a `label:` | A section heading (`##`) |
| `evalScript` with a `label:` | The label, written out as markdown |
| Any other command with a `label:` | A numbered step |
| `takeScreenshot` | An image. After a step it is nested under that step. |

Commands without a label are ignored, so assertions and setup stay out of the
docs. Maestro has no text-only command, so put markdown on a no-op `evalScript`.
Paragraphs, lists and Docusaurus admonitions (`:::tip`, `:::warning`) all work,
because the label is just markdown. Keep screenshots behind `TEST2DOC` so
regular test runs skip them.

```yaml
name: Manage your todo list
---
- runFlow:
    label: Delete a todo item
    commands:
      - evalScript:
          script: ${0}
          label: |
            :::warning
            Deleting a todo item is permanent. There is no undo.
            :::
      - tapOn:
          text: Delete
          label: Tap **Delete** next to the item you want to remove.
      - assertNotVisible: "Buy milk"
      - runFlow:
          when:
            true: ${TEST2DOC == 'true'}
          commands:
            - takeScreenshot: deleted
```

Use literal labels. Maestro only resolves `${variables}` in some labels
(`tapOn` does, `inputText`, `pressKey` and `evalScript` do not).

Each flow becomes `test2doc-<flow-name>.mdx`. Screenshots are copied next to it
as `test2doc-<hash>.png`. Old `test2doc-*` files in the output directory are
removed first, but only after every flow parsed, so a failed run keeps the
existing docs.

## Highlighting elements

A screenshot marks the elements that the steps after it tap. Each labeled
`tapOn` between a `takeScreenshot` and the next screenshot or section gets an
outline around the element it tapped, and a badge with the step's number, so the
image lines up with the numbered list:

```yaml
- runFlow:
    label: Delete a todo item
    commands:
      - runFlow:            # takeScreenshot, behind TEST2DOC as above
          file: screenshot.yaml
          env:
            NAME: delete-before
      - tapOn:
          text: Delete
          label: Tap **Delete** next to the item you want to remove.   # step 1
```

So take the screenshot **before** the tap, while the element is still on screen.
A screenshot taken after a step shows the result and is left unmarked, and a
tap without a `label:` is not marked.

Maestro writes the matched element's bounds to `maestro.log` only for taps, so
that is where the highlights come from. The package reads them from the log of
each flow, and pairs each tap command with the logged element that fits its
selector. If a tap cannot be found in the log, its highlight is skipped.

iOS reports bounds in points and Android and web in pixels. For iOS the scale
(screenshot pixels per point) is worked out from the screenshot's width, for
example 3 for a 1206px wide iPhone screenshot. If the width is not one it
recognizes, the highlights are skipped with a warning, and you can give the
scale yourself:

```bash
test2doc-maestro -i android=out/android -i ios@3=out/ios -i web=out/web -o docs
```

The badge carries the step number. The step's text is the annotation, so the
image has no free-form text of its own.

## Several platforms on one page

Run the same flow on each platform into its own output directory, then give
the CLI one labeled input per platform:

```bash
maestro test -e TEST2DOC=true --test-output-dir out/android .maestro
maestro test -e TEST2DOC=true --test-output-dir out/web .maestro
test2doc-maestro -i android=out/android -i web=out/web -o docs
```

Each flow still becomes one page. Every screenshot becomes a Docusaurus `Tabs`
group, one tab per platform, and the tabs stay in sync across the page
(`groupId="platform"`). The platform label is the name you gave, with `ios`,
`android` and `web` shown as iOS, Android and Web. Pages that use tabs import
`@theme/Tabs` and `@theme/TabItem`, which the classic preset provides.

The platforms must run the same flow: the same sections, labels and screenshot
names. If they differ, generation fails and says which platforms disagree.

## Limitations

- Only tapped elements can be highlighted, because that is all Maestro logs the
  bounds of. Assertions such as `assertVisible` cannot be marked.
- Highlights are numbered badges, not text drawn on the image.
- No Docusaurus front matter or categories yet.
- Screenshots are as Maestro took them. A phone status bar or a dev overlay
  (for example Expo's dev tools button on web) will show up in the docs.
