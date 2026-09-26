---
title: FAQs
sidebar_position: 5
---
# Frequently Asked Questions
Here are a few common questions that get asked about Test2Doc.

## Can I use Test2Doc with other test frameworks?
Not currently. I do plan on adding support for cypress and possibly other frameworks in the future based on user feedback.

## Can I use Test2Doc with other languages?
Not currently. Support for all the languages Playwright supports is something I'd like to support if there is demand for it.

## How do I customize the output directory?
You can change the output directory in `playwright-test2doc.config.ts`. Look for the `outputDir` in the [Setup guide](./getting-started/setup.mdx).

## What happens if I manually edit generated files?
Your edit will be overwritten by the next time you run Test2Doc.

## Can I add handwritten files alongside generated files?
Yes. Test2Doc only overwrites files prefixed with `test2doc-`. Handwritten files without this prefix will remain untouched.

The one exception is screenshots with a [fixed file name](./user-guide/screenshots/screenshots.md#setting-a-fixed-file-name). They're written with exactly the name you give, so avoid names that match your handwritten files.

## Can I use Test2Doc with an existing Docusaurus site?
Yes. Test2Doc generates Markdown files and `_category_.json` files that are fully compatible with Docusaurus. You can configure the `outputDir` to point to your existing Docusaurus docs folder.

## Can I exclude certain tests from generating documentation?
Yes! You can use tags to filter which tests are included in the documentation. See the [Filtering Tests guide](./getting-started/filtering-tests.md) for more details.

## Can I customize the metadata or categories for generated docs?
Absolutely. You can use `withDocMeta` to add custom metadata to a page and `withDocCategory` to organize pages into categories. See the [Using Describe Blocks guide](./user-guide/using-describe-blocks.md) for examples.
