import { generateKeyPairSync, randomBytes } from "node:crypto"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Command, type OptionValues } from "commander"

export interface TestPasskey {
  username: string
  userId: string
  rpId: string
  id: string
  userHandle: string
  privateKey: string
  publicKey: string
  cosePublicKey: number[]
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url")
}

/**
 * Encode an ECDSA P-256 public key as a COSE_Key, the format WebAuthn servers
 * like `@simplewebauthn/server` store and verify with.
 *
 * The key is always the same CBOR map of 5 entries, so it's written out by
 * hand rather than pulling in a CBOR library:
 * { 1 (kty): 2 (EC2), 3 (alg): -7 (ES256), -1 (crv): 1 (P-256), -2 (x): bytes, -3 (y): bytes }
 */
function toCosePublicKey(x: Buffer, y: Buffer): number[] {
  // biome-ignore format: one line per COSE map entry
  return [
    0xa5, // map with 5 entries
    0x01, 0x02, // kty: EC2
    0x03, 0x26, // alg: ES256 (-7)
    0x20, 0x01, // crv (-1): P-256
    0x21, 0x58, 0x20, ...x, // x (-2): 32 byte string
    0x22, 0x58, 0x20, ...y, // y (-3): 32 byte string
  ]
}

/**
 * Generate a test passkey credential.
 *
 * A passkey is just an ECDSA P-256 keypair plus some WebAuthn bookkeeping
 * (credential id, user handle). None of that requires a real authenticator
 * ceremony, so this generates it directly with node:crypto rather than
 * driving a browser through Playwright's virtual WebAuthn authenticator.
 *
 * @param username - Username to associate with the credential.
 * @param userId - User ID to associate with the credential; also encoded
 * as the WebAuthn user handle.
 * @param rpId - Relying party id the credential is scoped to.
 * @returns The generated passkey. The binary fields Playwright's
 * `context.credentials.create()` takes are base64url-encoded, and
 * `cosePublicKey` has the public key as COSE bytes to store in your app's
 * database.
 */
export function generateTestPasskey(
  username: string,
  userId: string,
  rpId = "localhost",
): TestPasskey {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  })
  const { x, y } = publicKey.export({ format: "jwk" })
  if (!x || !y) throw new Error("Expected an EC public key")

  return {
    username,
    userId,
    rpId,
    id: toBase64Url(randomBytes(16)),
    userHandle: toBase64Url(Buffer.from(userId, "utf8")),
    privateKey: toBase64Url(
      privateKey.export({ format: "der", type: "pkcs8" }),
    ),
    publicKey: toBase64Url(publicKey.export({ format: "der", type: "spki" })),
    cosePublicKey: toCosePublicKey(
      Buffer.from(x, "base64url"),
      Buffer.from(y, "base64url"),
    ),
  }
}

interface Options extends OptionValues {
  output: string
  type: "json" | "ts" | "js" | "javascript" | "typescript"
  username: string
  userId: string
}

export async function main({
  output = "test-passkey.ts",
  type = "ts",
  username = "testuser",
  userId = crypto.randomUUID(),
}: Partial<Options> = {}) {
  console.log("Generating test passkey...")
  console.log(`Username: ${username}`)
  console.log(`User ID: ${userId}`)

  const passkey = generateTestPasskey(username, userId)

  // Map type to file extension
  const extensionMap: Record<string, string> = {
    json: ".json",
    js: ".js",
    javascript: ".js",
    ts: ".ts",
    typescript: ".ts",
  }
  const ext = extensionMap[type] || ".ts"
  output = output.replace(/\.\w+$/, "") + ext

  const outputPath = join(process.cwd(), output)
  const stringifyPasskey = JSON.stringify(passkey, null, 2)
  const content =
    type === "json"
      ? stringifyPasskey
      : `export const TESTPASSKEY = ${stringifyPasskey}`

  writeFileSync(outputPath, content)
  console.log(`✓ Test passkey generated and saved to ${outputPath}`)
  console.log("\nGenerated passkey:")
  console.log(stringifyPasskey)
}

export async function runCli(argv = process.argv) {
  const program = new Command()
  program
    .option(
      "-o, --output <path>",
      "output path for generated passkey",
      "test-passkey.ts",
    )
    .option(
      "-t, --type <type>",
      "output file type (json, ts, js, typescript, javascript)",
      "ts",
    )
    .option(
      "-u, --username <username>",
      "username for the credential",
      "testuser",
    )
    .option(
      "-i, --user-id <userId>",
      "user id for the credential (defaults to a random UUID)",
    )
    .parse(argv)

  const opts = program.opts()
  await main(opts)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch(console.error)
}
