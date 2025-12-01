import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "openJII",
  tagline: "Documentation Hub",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://your-docusaurus-site.example.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "JII", // Usually your GitHub org/user name.
  projectName: "openJII", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    mermaid: true,
  },
  themes: ["@docusaurus/theme-mermaid"],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/Jan-IngenHousz-Institute/open-jii/tree/main/apps",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/logo.png",
    navbar: {
      title: "openJII Docs",
      logo: {
        alt: "JII Logo",
        src: "img/logo.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
        {
          label: "API",
          position: "left", // Position in the navbar
          items: [
            {
              label: "MQTT",
              to: "/api/mqtt",
            },
            {
              label: "REST",
              to: "/api/rest",
            },
          ],
        },
        {
          href: "https://github.com/Jan-IngenHousz-Institute/open-jii",
          label: "Source Code",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Introduction",
              to: "/docs/introduction/overview",
            },/*
            {
              label: "Getting Started",
              to: "/docs/category/installation--setup",
            },
            {
              label: "Platform Usage",
              to: "/docs/category/sensor-operation",
            },
            {
              label: "Methodology & Analysis",
              to: "/docs/category/sensor-calibration--measurement",
            },*/
            {
              label: "Developer's Guide",
              to: "/docs/category/developers-guide",
            },/*
            {
              label: "FAQ & Support",
              to: "/docs/category/support-channels",
            },*/
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Contributing",
              href: "/",
            },
            {
              label: "Community Hub",
              href: "/",
            },
            {
              label: "JII Contact",
              href: "https://www.jan-ingenhousz-institute.org/contact",
            },

          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Legal & Privacy",
              href: "https://www.jan-ingenhousz-institute.org/privacy-policy",
            },
            {
              label: "Security",
              href: "https://github.com/Jan-IngenHousz-Institute/open-jii/security",
            },
            {
              label: "Report an Issue",
              href: "https://github.com/Jan-IngenHousz-Institute/open-jii/issues",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} openJII - openJII Documentation Hub - Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    algolia: {
      // The application ID provided by Algolia
      appId: "YOUR_APP_ID",

      // Public API key: it is safe to commit it
      apiKey: "YOUR_SEARCH_API_KEY",

      indexName: "YOUR_INDEX_NAME",

      // Optional: see doc section below
      contextualSearch: true,

      // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
      externalUrlRegex: "external\\.com|domain\\.com",

      // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
      replaceSearchResultPathname: {
        from: "/docs/", // or as RegExp: /\/docs\//
        to: "/",
      },

      // Optional: Algolia search parameters
      searchParameters: {},

      // Optional: path for search page that enabled by default (`false` to disable it)
      searchPagePath: "search",

      // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
      insights: false,

      //... other Algolia params
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
