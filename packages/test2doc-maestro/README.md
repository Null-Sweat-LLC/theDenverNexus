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

- Wrap each documented step in a `runFlow` with a `label:`. The label becomes
  the step text. Unlabeled commands are ignored.
- Use `takeScreenshot` for images, gated so regular test runs skip them:

```yaml
- runFlow:
    label: Create todo items
    commands:
      - tapOn: "Add"
      - runFlow:
          when:
            true: ${TEST2DOC == 'true'}
          commands:
            - takeScreenshot: created
```

Each flow becomes `test2doc-<flow-name>.mdx`, named from the flow's `name:`.
Screenshots are copied next to it as `test2doc-<hash>.png`. Old `test2doc-*`
files in the output directory are removed first, but only after every flow
parsed, so a failed run keeps the existing docs.

## Limitations

- If the same flow name appears in several runs (for example the same flow on
  web and Android), the latest run wins.
- Screenshots have no element highlights: Maestro does not record the bounds of
  matched elements in its structured output.
- No Docusaurus front matter or categories yet.
