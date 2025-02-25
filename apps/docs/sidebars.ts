import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  docs: [
    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <div class="sidebar-divider-label">Introduction</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "doc",
      id: "introduction/overview",
      label: "Overview",
    },
    {
      type: "doc",
      id: "introduction/key-features",
      label: "Key Features",
    },
    {
      type: "doc",
      id: "introduction/quick-start-guide",
      label: "Quick Start Guide",
    },
    {
      type: "doc",
      id: "introduction/changelog-release-notes",
      label: "Changelog & Release Notes",
    },
    {
      type: "doc",
      id: "introduction/glossary-terminology",
      label: "Glossary & Terminology",
    },
    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <hr class="sidebar-divider-line" />
          <div class="sidebar-divider-label">Getting Started</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "category",
      label: "Installation & Setup",
      link: { type: "generated-index" },
      collapsed: false,
      items: [
        "getting-started/installation-setup/software-installation",
        "getting-started/installation-setup/system-requirements",
        "getting-started/installation-setup/environment-configuration",
      ],
    },
    {
      type: "category",
      label: "Hardware & Device Linking",
      link: { type: "generated-index" },
      collapsed: false,
      items: [
        "getting-started/hardware-device-linking/unboxing-assembly",
        "getting-started/hardware-device-linking/device-registration-linking",
        "getting-started/hardware-device-linking/network-mqtt-configuration",
      ],
    },

    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <hr class="sidebar-divider-line" />
          <div class="sidebar-divider-label">Platform Usage</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "category",
      label: "Sensor Operation",
      link: { type: "generated-index" },
      items: [
        "platform-usage/sensor-operation/performing-measurements",
        "platform-usage/sensor-operation/data-ingestion-workflow",
      ],
    },
    {
      type: "category",
      label: "Data Analysis & Exploration",
      link: { type: "generated-index" },
      items: [
        "platform-usage/data-analysis/setup-databricks-environment",
        "platform-usage/data-analysis/querying-data",
        "platform-usage/data-analysis/visualization-reporting",
        "platform-usage/data-analysis/notebook-best-practices",
      ],
    },
    {
      type: "category",
      label: "Experiments",
      link: { type: "generated-index" },
      items: [
        "platform-usage/experiments-protocols/experiments/defining-an-experiment",
        "platform-usage/experiments-protocols/experiments/experiment-management",
        "platform-usage/experiments-protocols/experiments/integrating-experiments-data-analysis",
      ],
    },
    {
      type: "category",
      label: "Protocols",
      link: { type: "generated-index" },
      items: [
        "platform-usage/experiments-protocols/protocols/defining-a-protocol",
        "platform-usage/experiments-protocols/protocols/protocol-workflow",
        "platform-usage/experiments-protocols/protocols/protocol-documentation-standards",
      ],
    },

    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <hr class="sidebar-divider-line" />
          <div class="sidebar-divider-label">Methodology & Analysis</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "category",
      label: "Sensor Calibration & Measurement",
      link: { type: "generated-index" },
      items: [
        "methodology-analysis/sensor-calibration/calibration-procedures",
        "methodology-analysis/sensor-calibration/measurement-protocols",
        "methodology-analysis/sensor-calibration/data-validation",
      ],
    },
    {
      type: "category",
      label: "Data Analysis & Statistical Methods",
      link: { type: "generated-index" },
      items: [
        "methodology-analysis/data-analysis/processing-pipelines",
        "methodology-analysis/data-analysis/analytical-tools",
        "methodology-analysis/data-analysis/statistical-models",
      ],
    },
    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <hr class="sidebar-divider-line" />
          <div class="sidebar-divider-label">For Developers</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "category",
      label: "Developer's Guide",
      link: { type: "generated-index" },
      items: [
        "for-developers/developers-guide/system-architecture-data-pipeline",
        {
          type: "category",
          label: "Design Decisions",
          link: { type: "generated-index" },
          items: [
            {
              type: "category",
              label: "Proposals",
              link: { type: "generated-index" },
              items: [
                "for-developers/developers-guide/design-decisions/proposals/mqtt-proposal",
              ],
            },
            {
              type: "category",
              label: "ADRs",
              link: { type: "generated-index" },
              items: [
                "for-developers/developers-guide/design-decisions/adrs/template",
              ],
            },
          ],
        },
        "for-developers/developers-guide/api-documentation",
        "for-developers/developers-guide/extending-the-platform",
      ],
    },
    {
      type: "category",
      label: "Best Practices",
      link: { type: "generated-index" },
      items: [
        "for-developers/best-practices/coding-guidelines",
        "for-developers/best-practices/testing-strategies",
        "for-developers/best-practices/performance-optimization",
      ],
    },
    {
      type: "category",
      label: "Developer Troubleshooting",
      link: { type: "generated-index" },
      items: [
        "for-developers/developer-troubleshooting/common-issues",
        "for-developers/developer-troubleshooting/debugging-tips",
        "for-developers/developer-troubleshooting/developer-faq",
      ],
    },
    {
      type: "html",
      value: `
        <div class="sidebar-divider">
          <hr class="sidebar-divider-line" />
          <div class="sidebar-divider-label">FAQ & Support</div>
        </div>
      `,
      defaultStyle: false,
    },
    {
      type: "doc",
      id: "faq-support/frequently-asked-questions",
      label: "Frequently Asked Questions",
    },
    {
      type: "category",
      label: "Support Channels",
      link: { type: "generated-index" },
      items: [
        "faq-support/support-channels/community-forums",
        "faq-support/support-channels/email-ticket-support",
        "faq-support/support-channels/live-chat-social-media",
      ],
    },
  ],
};

export default sidebars;
