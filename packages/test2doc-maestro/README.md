# @test2doc/maestro

Generate Docusaurus docs from [Maestro](https://maestro.dev) flow runs.

Maestro has no reporter API, so this is a CLI that reads the artifacts of a
finished run (`--test-output-dir`) and writes the docs.

## Installation

You need:

- **Node 18 or newer**, to run the CLI.
- **Maestro**, which needs Java 17 or newer:

  ```bash
  curl -fsSL "https://get.maestro.mobile.dev" | bash
  ```

  Windows and the rest of the details are in
  [Maestro's install docs](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).
- **Something to run your app on** for each platform you want documented: an
  Android emulator, an iOS simulator, or a browser.

Then add the package to your project:

```bash
npm install --save-dev @test2doc/maestro
```

It provides the `test2doc-maestro` command, which you can run with
`npx test2doc-maestro` or from a package script.

Nothing in the package depends on how your app is built. It only reads what
Maestro writes out, so it works with anything Maestro can drive, not just React
Native.

## Setup

Add a small helper flow that takes a screenshot only when `TEST2DOC` is set, so
regular test runs skip the screenshots. Put it next to your flows, for example
as `.maestro/_shared/screenshot.yaml` (Maestro runs only the flows at the top
level of `.maestro`, so a subfolder keeps helpers out of the test run):

```yaml
appId: com.example.app
---
- runFlow:
    when:
      true: ${TEST2DOC == 'true'}
    commands:
      - takeScreenshot: ${NAME}
```

Call it from your flows wherever you want a picture, passing a `NAME`:

```yaml
- runFlow:
    file: _shared/screenshot.yaml
    env:
      NAME: add-before
```

The rest of setup is labeling your flows, described in
[Writing flows for docs](#writing-flows-for-docs).

## Usage

```bash
maestro test -e TEST2DOC=true --test-output-dir maestro-output .maestro
test2doc-maestro --input maestro-output --output docs
```

Point `--output` at your Docusaurus `docs` folder and the pages appear in your
site. To run both steps with one command, add a script to your `package.json`:

```json
{
  "scripts": {
    "docs:generate": "rm -rf maestro-output && maestro test -e TEST2DOC=true --test-output-dir maestro-output .maestro && test2doc-maestro -i maestro-output -o docs"
  }
}
```

Clearing `maestro-output` first keeps flows you have since deleted from
lingering in the docs.

| Option | Description |
| --- | --- |
| `-i, --input <[platform[@scale]=]dir>` | The directory passed to `--test-output-dir` (required). Repeat it with a platform for each to document several platforms, and add `@scale` for iOS if needed. |
| `-o, --output <dir>` | Where to write the docs (default `./docs`) |
| `-c, --config <file>` | JSON with `annotationDefaults`, to style the annotations |

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

## Highlighting and annotating elements

Screenshots are annotated the same way `@test2doc/playwright` annotates them:
the element is outlined and tinted, and a label is drawn beside it, with an
arrow to it if you turn arrows on.

A screenshot marks the elements that the labeled `tapOn` steps after it tap,
up to the next screenshot or section. The label is the step's words, without
their markdown. So take the screenshot **before** the tap, while the element is
still on screen:

```yaml
- runFlow:
    label: Add a todo item
    commands:
      - runFlow:            # takeScreenshot, behind TEST2DOC as above
          file: screenshot.yaml
          env:
            NAME: add-before
      - tapOn:
          id: todo-input
          label: Tap the text field at the top of the screen.   # the annotation
```

A screenshot taken after a step shows the result and is left unmarked, and a
tap without a `label:` is not marked.

### Styling

Give every annotation a style with a JSON config file, the equivalent of
Playwright's `annotationDefaults`:

```bash
test2doc-maestro -i android=out/android -o docs --config test2doc-maestro.config.json
```

```json
{
  "annotationDefaults": {
    "showArrow": true,
    "font": "bold 14px Arial",
    "labelMaxWidth": 210,
    "labelBoxPadding": 8,
    "labelBoxFillStyle": "rgba(255, 255, 255, 0.96)",
    "labelBoxStrokeStyle": "rgba(255, 90, 31, 1)",
    "highlightStrokeStyle": "rgba(255, 90, 31, 1)",
    "highlightFillStyle": "rgba(255, 90, 31, 0.15)",
    "arrowStrokeStyle": "rgba(255, 90, 31, 1)"
  }
}
```

The options and their defaults are the same as Playwright's `AnnotationOptions`:
`text`, `labelMaxWidth`, `textAlign`, `fillStyle`, `font`, `strokeStyle`,
`lineWidth`, `labelBoxFillStyle`, `labelBoxStrokeStyle`, `labelBoxLineWidth`,
`labelBoxPadding`, `highlightFillStyle`, `highlightStrokeStyle`,
`highlightLineWidth`, `position` (`"above"`, `"below"`, `"left"`, `"right"` or
degrees clockwise from the top), `showArrow`, `arrowStrokeStyle` and
`arrowLineWidth`. Colors are canvas styles, like CSS colors. An unknown or
mistyped option fails generation, so typos do not pass silently.

Sizes (line widths, padding, `labelMaxWidth` and the px size in `font`) are in
layout units, like CSS px, and scale with the screenshot. So one style suits a
500px wide web screenshot and a 1206px wide iOS one. Labels wrap at 70% of the
screenshot's width unless `labelMaxWidth` says otherwise.

Text is drawn with the fonts installed where the docs are generated. The Inter
font is bundled, under the SIL Open Font License (`fonts/Inter-LICENSE.txt`), and
used wherever the font you ask for is missing, such as in a CI container.

### One annotation's options

Options for a single step go after its label, the same way Playwright's metadata
is written into titles. They win over the config's defaults and are left out of
the step's text in the docs:

```yaml
- tapOn:
    text: Delete
    label: 'Tap **Delete** next to the item. [test2doc_annotation]:{"position":"left","labelMaxWidth":150}'
```

Use `"text"` to annotate with other words than the step's, or `"text": ""` for a
highlight with no label.

### Where the bounds come from

Maestro writes the matched element's bounds to `maestro.log` only for taps, so
that is where the highlights come from. The package reads them from the log of
each flow, and pairs each tap command with the logged element that fits its
selector. If a tap cannot be found in the log, its annotation is skipped.

iOS reports bounds in points and Android and web in pixels. For iOS the scale
(screenshot pixels per point) is worked out from the screenshot's width, for
example 3 for a 1206px wide iPhone screenshot. If the width is not one it
recognizes, the annotations are skipped with a warning, and you can give the
scale yourself:

```bash
test2doc-maestro -i android=out/android -i ios@3=out/ios -i web=out/web -o docs
```

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
- Labels are only placed clear of their own element, like in
  `@test2doc/playwright`, so one can cover other parts of the screen. Move it
  with `position` or narrow it with `labelMaxWidth`.
- No Docusaurus front matter or categories yet.
- Screenshots are as Maestro took them. A phone status bar or a dev overlay
  (for example Expo's dev tools button on web) will show up in the docs.

## Releases

Releases are automatic: a push to `main` that changes the package's source runs
the `Release - test2doc-maestro` workflow, which versions the release from the
commit messages (`feat:` is a minor release, `fix:` and `perf:` are patches),
updates `CHANGELOG.md`, publishes to npm and creates a GitHub release. Tags look
like `test2doc-maestro-v0.1.0`.

While the package is being tried out it stays on 0.x, so a breaking change
(`feat!:` or a `BREAKING CHANGE:` footer) bumps the minor version instead of
jumping to 1.0.0. To move to 1.0.0, remove the `"breaking": true` rule from
`.releaserc.json`, and the next breaking change releases 1.0.0.
