import type { Page } from "@playwright/test"

export async function setTabVisibility(
  page: Page,
  state: "visible" | "hidden",
) {
  await page.evaluate((visibilityState) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  }, state)
}
