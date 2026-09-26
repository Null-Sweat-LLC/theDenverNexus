import { expect, test } from "vitest"
import { mkdir, rmdir, unlink, access } from "node:fs/promises"
import { join } from "node:path"
import { createPublicKey } from "node:crypto"
import {
  convertCOSEtoPKCS,
  cose,
  isoCBOR,
} from "@simplewebauthn/server/helpers"
import { generateTestPasskey, main } from "./index.js"

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertTestPasskey(TESTPASSKEY: {
  username: string
  userId: string
  rpId: string
  id: string
  userHandle: string
  privateKey: string
  publicKey: string
  cosePublicKey: number[]
}) {
  expect(TESTPASSKEY.username).toBe("testuser")
  expect(TESTPASSKEY.userId).toMatch(UUID_V4_REGEX)
  expect(TESTPASSKEY.rpId).toBe("localhost")
  expect(TESTPASSKEY.id).toBeDefined()
  expect(TESTPASSKEY.userHandle).toBeDefined()
  expect(TESTPASSKEY.privateKey).toBeDefined()
  expect(TESTPASSKEY.publicKey).toBeDefined()
  expect(TESTPASSKEY.cosePublicKey).toHaveLength(77)
}

test("cosePublicKey is the same key as publicKey, encoded as COSE", () => {
  const passkey = generateTestPasskey("testuser", "user-123")
  const { x, y } = createPublicKey({
    key: Buffer.from(passkey.publicKey, "base64url"),
    format: "der",
    type: "spki",
  }).export({ format: "jwk" })
  if (!x || !y) throw new Error("Expected an EC public key")

  // Encoded independently, the way @simplewebauthn/server builds COSE keys
  const expected = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [cose.COSEKEYS.kty, cose.COSEKTY.EC2],
      [cose.COSEKEYS.alg, cose.COSEALG.ES256],
      [cose.COSEKEYS.crv, cose.COSECRV.P256],
      [cose.COSEKEYS.x, Buffer.from(x, "base64url")],
      [cose.COSEKEYS.y, Buffer.from(y, "base64url")],
    ]) as Parameters<typeof isoCBOR.encode>[0],
  )
  expect(passkey.cosePublicKey).toEqual([...expected])

  // And decodes back to the same point on the curve
  const point = convertCOSEtoPKCS(Uint8Array.from(passkey.cosePublicKey))
  expect(Buffer.from(point)).toEqual(
    Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(x, "base64url"),
      Buffer.from(y, "base64url"),
    ]),
  )
})

test("generate a test passkey file", async () => {
  const outputPath = join(process.cwd(), "test-passkey.ts")
  try {
    await unlink(outputPath)
  } catch {
    // ignore if not present
  }
  await main()

  const { TESTPASSKEY } = await import(outputPath)
  assertTestPasskey(TESTPASSKEY)

  try {
    await unlink(outputPath)
  } catch {}
})

test("generate a passkey with a custom username and user id", async () => {
  const outputPath = join(process.cwd(), "custom-passkey.ts")
  try {
    await unlink(outputPath)
  } catch {
    // ignore if not present
  }

  await main({
    output: "custom-passkey.ts",
    username: "alice",
    userId: "user-123",
  })

  const { TESTPASSKEY } = await import(outputPath)
  expect(TESTPASSKEY.username).toBe("alice")
  expect(TESTPASSKEY.userId).toBe("user-123")

  try {
    await unlink(outputPath)
  } catch {}
})

test("default username and user id remain independent between calls", async () => {
  const outputPath = join(process.cwd(), "default-passkey.ts")
  try {
    await unlink(outputPath)
  } catch {
    // ignore if not present
  }

  await main({ output: "default-passkey.ts" })

  const { TESTPASSKEY: first } = await import(`${outputPath}?first`)
  await main({ output: "default-passkey.ts" })
  const { TESTPASSKEY: second } = await import(`${outputPath}?second`)

  expect(first.username).toBe("testuser")
  expect(second.username).toBe("testuser")
  expect(first.userId).toMatch(UUID_V4_REGEX)
  expect(second.userId).toMatch(UUID_V4_REGEX)
  expect(first.userId).not.toBe(second.userId)

  try {
    await unlink(outputPath)
  } catch {}
})

test("generate a passkey to the output path specified", async () => {
  const tempDir = "tmp-output"
  const dir = join(process.cwd(), tempDir)
  const fileName = "my-passkey.ts"
  const outputPath = join(dir, fileName)

  try {
    await unlink(outputPath)
  } catch {}
  try {
    await rmdir(dir)
  } catch {}

  await mkdir(dir, { recursive: true })

  await main({ output: join(tempDir, fileName) })

  const { TESTPASSKEY } = await import(outputPath)
  assertTestPasskey(TESTPASSKEY)

  try {
    await unlink(outputPath)
    await rmdir(dir)
  } catch {}
})

test("generate JSON passkey file", async () => {
  const outputPath = join(process.cwd(), "test-passkey.json")
  try {
    await unlink(outputPath)
  } catch {
    // ignore if not present
  }
  await main({ type: "json" })

  const fs = await import("fs/promises")
  const content = await fs.readFile(outputPath, "utf-8")
  const TESTPASSKEY = JSON.parse(content)

  assertTestPasskey(TESTPASSKEY)

  try {
    await unlink(outputPath)
  } catch {}
})

test("generate javascript passkey file and make the extension js", async () => {
  const outputPath = join(process.cwd(), "test-passkey.json")
  const expectedPath = join(process.cwd(), "test-passkey.js")
  try {
    await unlink(outputPath)
    await unlink(expectedPath)
  } catch {
    // ignore if not present
  }
  await main({ type: "javascript" })

  await access(expectedPath)
  const { TESTPASSKEY } = await import(expectedPath)

  assertTestPasskey(TESTPASSKEY)

  try {
    await unlink(outputPath)
    await unlink(expectedPath)
  } catch {}
})

test("generate the correct extension if the output filename is missing the extension", async () => {
  const outputPath = join(process.cwd(), "test-passkey")
  const expectedPath = join(process.cwd(), "test-passkey.ts")
  try {
    await unlink(expectedPath)
    await unlink(outputPath)
  } catch {
    // ignore if not present
  }
  await main({ output: "test-passkey" })

  await access(expectedPath)
  const { TESTPASSKEY } = await import(expectedPath)
  expect(TESTPASSKEY).toBeDefined()

  try {
    await unlink(expectedPath)
    await unlink(outputPath)
  } catch {}
})
