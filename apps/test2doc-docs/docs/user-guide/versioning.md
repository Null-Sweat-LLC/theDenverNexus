---

title: Versioning Your Docs
sidebar_position: 6
---

# Versioning Your Docs

Docusaurus has built-in versioning support that lets you snapshot your documentation at a point in time, preserving the docs for a specific release while the current docs continue to evolve.

## How it fits with Test2Doc

In a typical Test2Doc CI setup:

- **Every push** — tests run, the reporter regenerates docs into your `docs/` directory, and the site is deployed. These are always the "current" (next/unreleased) docs.
- **On a release** — you snapshot the current `docs/` directory into a versioned copy so users running an older version of your software can still find accurate docs.

Versioning happens at release time, not on every push. Creating a snapshot on every CI run would produce a new version per commit, making the version dropdown meaningless.

## Creating a version snapshot

Docusaurus provides a CLI command to snapshot your current docs:

```bash
npx docusaurus docs:version 1.0
```

This command:

1. Copies `docs/` → `versioned_docs/version-1.0/`
2. Copies `sidebars.ts` → `versioned_sidebars/version-1.0-sidebars.json`
3. Adds `"1.0"` to `versions.json`

Run this as part of your release pipeline, after tests pass and docs are generated, but before deploying.

## Configuring the version dropdown

Add a `docsVersionDropdown` item to your navbar in `docusaurus.config.ts`:

```ts title="docusaurus.config.ts" {5-7}
navbar: {
  items: [
    // ... your existing items
    {
      type: "docsVersionDropdown",
      position: "right",
    },
  ],
},
```

## Wiring it into your release pipeline

Add the version snapshot step to whatever script runs on release. For example, using a `package.json` script:

```json title="package.json"
{
  "scripts": {
    "doc:gen": "TEST2DOC=true playwright test --config=playwright-test2doc.config.ts",
    "doc:release": "npm run doc:gen && npx docusaurus docs:version $npm_package_version"
  }
}
```

If you use semantic-release, add an `exec` step that runs after your test/doc generation step:

```json title=".releaserc.json"
[
  "@semantic-release/exec",
  {
    "prepareCmd": "npx docusaurus docs:version ${nextRelease.version}"
  }
]
```

## Further reading

- [Docusaurus Versioning](https://docusaurus.io/docs/versioning) — full reference for versioning configuration and managing older versions
