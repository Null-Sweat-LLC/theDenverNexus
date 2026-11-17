---

slug: start-of-tutorial
title: "Test Driven Development Tutorial using Playwright and RedwoodSDK"
authors: [dethstrobe]
tags: [testing]
---

**Test Driven Development (TDD)**: you've heard of it, maybe tried it, possibly given up on it. The theory sounds great, but how do you actually do it on a real project? That's what [my new tutorial tackles](/docs/tutorial-1), using [RedwoodSDK](https://rwsdk.com/) and [Playwright](https://playwright.dev/) to test and generate documentation using Test2Doc!
{/* truncate */}

## Why This Tutorial?

Most TDD tutorials use toy examples. This one doesn't.

This one builds a job application management app that is more complicated than a simple CRUD TODO app.

It teaches advanced concepts around:

- Authentication
- Seeding test data
- Making accessible websites
- Automated doc generation from tests

## Why RedwoodSDK?

RedwoodSDK is great because of its lack of magic. It's much easier to understand compared to many other meta-frameworks. Likewise, when I was looking to dogfood Test2Doc, I found their [ApplyWize tutorial](https://github.com/redwoodjs/sdk/blob/d7f2a6c10e55778dbc3c64af7be8202fdf9eb81d/docs/src/content/docs/tutorial/full-stack-app/1-setup.mdx) (which they have removed now, because there are breaking changes from v0 to v1).

So, since I thought this was a great use case, and the Redwood team was not currently going to maintain the tutorial, I figured I'd take it on myself to update it and also use it to teach TDD principles and show examples of how to write docs generated from tests.

## The Challenges of Writing the Tutorial

### ORM to Query Builder

One of the changes is that RedwoodSDK is moved from [D1](https://developers.cloudflare.com/d1/) to [SQLite Durable Objects](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) using [Prisma](https://www.prisma.io/) as an ORM to [Kysely](https://kysely.dev/) a query builder.

It has been a lot more work than I was expecting. I thought changing from Prisma to Kysely wasn't going to be that hard, but it kind of is. Prisma handled a lot of heavy lifting, like relational data, and converting of types which I then needed to translate into Kysely. A part of this was really fun to learn and figure out, but the way to best utilize these libraries within the project did take some time to research.

### Passkey Problems

The original tutorial had the developer just manually edit some of the seed data to match the current user to get started with testing.

Because I was building an automated testing tutorial that was unfortunately not good enough. So I invested a few days into learning how passkeys **really** work under the hood so that I could consistently create a passkey, associate it with a user, and use that passkey in Playwright to handle authentication.

I ended up creating 2 new libraries to handle this. One for [passkey generation](https://www.npmjs.com/package/@test2doc/playwright-passkey-gen) and the other for [adding the passkey to Playwright](https://www.npmjs.com/package/@test2doc/playwright-passkey) (and a few utility functions).

Investigating and creating these packages took about a week of work. These tools now make it possible for anyone to implement passkey automated testing in their Playwright tests.

## Give it a shot

Try out the tutorial and tell me what you think. You can send me a message on the [BlueSky](https://bsky.app/profile/dethstrobe.bsky.social), [Reddit](https://www.reddit.com/user/dethstrobe/), or join our new [Discord](https://discord.gg/ZB8ktRVZ7P).

Also stay tuned. I've released the first 5 parts, with 4 more coming soon (9 total).
