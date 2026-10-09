import type { TestInfo } from "@playwright/test"
import { injectMarkdown } from "@test2doc/playwright/injectMarkdown"

export const HYDRATION_DELAY_MS = 1_000

// Stands in for hydration: the markup is on the page right away, but the
// script only attaches its listeners after HYDRATION_DELAY_MS.
export const hydrateLater = (script: string) => `
  <script>
    setTimeout(() => {
      ${script}
    }, ${HYDRATION_DELAY_MS})
  </script>
`

// Mimics React's value tracker: onChange only fires when the value differs
// from the last one React saw.
export const trackValue = (selector: string) => `
  const field = document.querySelector("${selector}")
  let lastSeen = field.value
  const onChange = () => {
    if (field.value === lastSeen) return
    lastSeen = field.value
    document.querySelector("output").textContent = field.value
  }
  field.addEventListener("input", onChange)
  field.addEventListener("change", onChange)
`

export const injectCode = (testInfo: TestInfo, code: string) =>
  injectMarkdown(testInfo, `\`\`\`ts\n${code.trim()}\n\`\`\``)
