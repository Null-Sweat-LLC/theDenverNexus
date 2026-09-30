import type * as Preset from "@docusaurus/preset-classic"
import type { Config } from "@docusaurus/types"

const config: Config = {
  title: "Todo Demo",
  tagline: "Docs generated from Maestro flows by test2doc.",
  future: {
    v4: true,
  },
  url: "http://localhost",
  baseUrl: "/",
  organizationName: "Null Sweat, LLC",
  projectName: "test2doc-maestro-demo-docs",
  onBrokenLinks: "throw",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Todo Demo",
    },
  } satisfies Preset.ThemeConfig,
}

export default config
