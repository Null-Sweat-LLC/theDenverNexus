import { expect, type Locator } from "@playwright/test"

export async function interactUntil(
  interact: () => Promise<unknown>,
  assert: () => Promise<void>,
  timeout = 15_000,
) {
  await expect(async () => {
    await interact()
    await assert()
  }).toPass({ timeout })
}

export interface ClickUntilOptions {
  timeout?: number
  settle?: number
}

export async function clickUntil(
  trigger: Locator,
  expected: Locator,
  { timeout = 15_000, settle = 2_000 }: ClickUntilOptions = {},
) {
  await interactUntil(
    async () => {
      await trigger.hover({ force: true })
      await trigger.click()
    },
    () => expect(expected).toBeVisible({ timeout: settle }),
    timeout,
  )
}

export async function fillWithChange(locator: Locator, value: string) {
  await locator.fill("")
  await locator.fill(value)
}

export async function selectWithChange(
  locator: Locator,
  option: { label: string } | { value: string },
) {
  await locator.selectOption({ index: 0 })
  await locator.selectOption(option)
}
