import type { CommandEntry } from "../types.js"

type Options = {
  depth?: number
  status?: string
  label?: string
  evaluatedLabel?: string
  artifacts?: { type: string; path: string }[]
}

let sequenceNumber = 0

export const resetSequence = () => {
  sequenceNumber = 0
}

export const entry = (
  commandName: string,
  {
    depth = 0,
    status = "COMPLETED",
    label,
    evaluatedLabel,
    artifacts,
  }: Options = {},
): CommandEntry => ({
  command: { [commandName]: label ? { label } : {} },
  metadata: {
    status,
    sequenceNumber: sequenceNumber++,
    depth,
    ...(evaluatedLabel
      ? { evaluatedCommand: { [commandName]: { label: evaluatedLabel } } }
      : {}),
    ...(artifacts ? { artifacts } : {}),
  },
})

export const section = (label: string, depth = 1) =>
  entry("runFlowCommand", { depth, label })

export const instruction = (label: string, depth = 2) =>
  entry("tapOnElement", { depth, label })

export const markdown = (label: string, depth = 2) =>
  entry("evalScriptCommand", { depth, label })

export const screenshot = (name: string, depth = 4) =>
  entry("takeScreenshotCommand", {
    depth,
    artifacts: [
      { type: "TAKE_SCREENSHOT", path: `takeScreenshot/${name}.png` },
    ],
  })
