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
| `-i, --input <dir>` | The directory passed to `--test-output-dir` (required) |
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

## Limitations

- If the same flow name appears in several runs (for example the same flow on
  web and Android), the latest run wins.
- Screenshots have no element highlights: Maestro does not record the bounds of
  matched elements in its structured output.
- No Docusaurus front matter or categories yet.
