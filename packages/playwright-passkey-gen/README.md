# @test2doc/playwright-passkey-gen

A CLI tool and library for generating test passkey credentials for WebAuthn testing. Generation is pure `node:crypto` — no browser, no Playwright. The generated credential is a plain ECDSA P-256 keypair shaped to drop straight into Playwright's native [`browserContext.credentials`](https://playwright.dev/docs/api/class-credentials) API (v1.61+) for use in tests, plus the public key in the COSE format WebAuthn servers store, so you can seed it into your app's database.

## Usage CLI

Generate a test passkey file from the command line:

```bash
# Generate a TypeScript file (default)
npx @test2doc/playwright-passkey-gen

# Generate with custom output path
npx @test2doc/playwright-passkey-gen --output path/to/my-passkey.ts

# Generate JSON file
npx @test2doc/playwright-passkey-gen --type json

# Generate JavaScript file
npx @test2doc/playwright-passkey-gen --type js

# Generate with a custom username and user id
npx @test2doc/playwright-passkey-gen --username alice --user-id user-123
```

**CLI Options:**
- `-o, --output <path>` - Output path for generated passkey (default: `test-passkey.ts`)
- `-t, --type <type>` - Output file type: `json`, `ts`, `js`, `typescript`, `javascript` (default: `ts`)
- `-u, --username <username>` - Username for the credential (default: `testuser`)
- `-i, --user-id <userId>` - User id for the credential (default: a random UUID)

## Installation

```bash
npm install -D @test2doc/playwright-passkey-gen
# or
pnpm add -D @test2doc/playwright-passkey-gen
# or
yarn add -D @test2doc/playwright-passkey-gen
```

### Programmatic API

```typescript
import { generateTestPasskey, main } from '@test2doc/playwright-passkey-gen';

// Generate a passkey programmatically (synchronous — no browser involved)
const passkey = generateTestPasskey('testuser', 'user-123');

// Or use the main function with options to generate and write a file
await main({
  output: 'my-passkey.ts',
  type: 'ts',
  username: 'alice',
  userId: 'user-123'
});
```

## Generated Output

The tool generates a test passkey credential with the following structure. `id`, `userHandle`, `privateKey` and `publicKey` are already in the base64url encoding Playwright's `credentials.create()` expects:

```typescript
export const TESTPASSKEY = {
  username: "testuser",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  rpId: "localhost",
  id: "base64url-encoded-credential-id",
  userHandle: "base64url-encoded-user-handle",
  privateKey: "base64url-encoded PKCS#8 (DER) private key",
  publicKey: "base64url-encoded SPKI (DER) public key",
  cosePublicKey: [/* the same public key as COSE bytes */]
}
```

`cosePublicKey` is the public key in the COSE format that WebAuthn servers like [`@simplewebauthn/server`](https://simplewebauthn.dev/) store and verify with. Playwright ignores it.

## Using Generated Passkeys

Seed the generated passkey directly with Playwright's native `credentials` API:

```typescript
import { test, expect } from '@playwright/test';
import { TESTPASSKEY } from './test-passkey';

test('authenticate with passkey', async ({ page }) => {
  const context = page.context();

  await context.credentials.create(TESTPASSKEY.rpId, TESTPASSKEY);
  await context.credentials.install();

  await page.goto('https://example.com/login');
  // navigator.credentials.get() resolves with the seeded passkey.
});
```

Playwright's `credentials` API is cross-browser, so this works unmodified in Chromium, Firefox, and WebKit. This package's own e2e test (`pnpm test`) runs against all three.

### Seeding your app's database

For the login to succeed, your app has to know about the passkey too. Store `id` as the credential id and `cosePublicKey` as the public key, the same way your app stores a passkey a user registers. For example, with `@simplewebauthn/server`:

```typescript
await db.insertInto('credentials').values({
  userId: TESTPASSKEY.userId,
  credentialId: TESTPASSKEY.id,
  publicKey: Uint8Array.from(TESTPASSKEY.cosePublicKey),
  counter: 0,
});
```

Seeding the passkey with `credentials.create()` starts its signature counter at 0 on every run, so if your server checks the counter, reset the stored `counter` to 0 before logging in.

## How It Works

A passkey is just an ECDSA P-256 keypair plus some WebAuthn bookkeeping (a credential id and a user handle) — none of that requires a real authenticator ceremony or a browser. `generateTestPasskey()` generates the keypair with `node:crypto`'s `generateKeyPairSync()` and encodes everything as base64url, matching the shape Playwright's `context.credentials.create()` expects when importing a known credential. It also writes the public key as a COSE key, a small fixed CBOR structure encoded by hand. No Chromium, no CDP virtual authenticator, no `@playwright/test` dependency at runtime.

The bundled demo server (`pnpm start`, exercised by the e2e test) verifies a generated passkey's login assertion with [`@simplewebauthn/server`](https://simplewebauthn.dev/), converting the SPKI public key into the COSE format that library expects. This cross-checks generated credentials against an independent WebAuthn implementation rather than only our own crypto code. That verification path (and Playwright itself) is only needed for this package's own dev/test workflow — not for generating a passkey.

## API Reference

### `generateTestPasskey(username, userId, rpId?)`

Generate a test passkey credential programmatically.

**Parameters:**
- `username` (string) - Username for the credential
- `userId` (string) - User ID (should be a UUID v4)
- `rpId` (string, optional) - Relying party id (default: `"localhost"`)

**Returns:** `TestPasskey` - The generated passkey credential

### `main(options?)`

Generate and save a test passkey file.

**Parameters:**
- `options` (object, optional)
  - `output` (string) - Output file path (default: `"test-passkey.ts"`)
  - `type` (string) - Output type: `"json"`, `"ts"`, `"js"`, `"typescript"`, or `"javascript"` (default: `"ts"`)
  - `username` (string) - Username for the credential (default: `"testuser"`)
  - `userId` (string) - User id for the credential (default: a random UUID)

**Returns:** `Promise<void>`

## Requirements

- Node.js 18+ (that's it — generation has no other runtime dependencies beyond `node:crypto`)

Consuming the generated passkey in a test needs Playwright `@playwright/test` v1.61+ (for `browserContext.credentials`), but that's a concern for your test suite, not for this package.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run unit tests only
pnpm unit

# Run CI tests (unit + e2e)
pnpm ci:test
```

## License

Apache-2.0

## Author

Null Sweat, LLC
