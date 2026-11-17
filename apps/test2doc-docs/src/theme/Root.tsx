import React, { ReactNode } from "react"
import { PostHogProvider } from "posthog-js/react"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"

interface RootProps {
  children: ReactNode
}

const Root = ({ children }: RootProps) => {
  const { siteConfig } = useDocusaurusContext()
  const { posthogHost, posthogKey } = siteConfig.customFields as {
    posthogKey: string
    posthogHost: string
  }
  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: posthogHost,
        defaults: "2025-05-24",
        capture_exceptions: true, // This enables capturing exceptions using Error Tracking
        debug: false,
      }}
    >
      {children}
    </PostHogProvider>
  )
}

export default Root
