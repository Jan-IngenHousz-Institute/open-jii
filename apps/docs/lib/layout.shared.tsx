import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

import { PLATFORM_URL } from "./platform-url";

export const GITHUB_OWNER = "Jan-IngenHousz-Institute";
export const GITHUB_REPO = "open-jii";
export const GITHUB_BRANCH = "main";
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

// Re-exported so existing "@/lib/layout.shared" importers keep working; the
// value is environment-resolved in ./platform-url.
export { PLATFORM_URL };

// Docs MDX lives here relative to repo root; used for "Edit on GitHub" links.
export const DOCS_CONTENT_ROOT = "apps/docs/content";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // One lockup, not a mark plus a "Docs" label: "DOCS" is part of the
      // artwork, so the accessible name lives in `alt` and nothing else here
      // may repeat it. See apps/docs/public/img/openjii-docs-lockup.svg.
      title: (
        <>
          <Image
            src="/img/openjii-docs-lockup.svg"
            alt="openJII Docs"
            width={91}
            height={40}
            className="block dark:hidden"
            priority
          />
          <Image
            src="/img/openjii-docs-lockup-dark.svg"
            alt="openJII Docs"
            width={91}
            height={40}
            className="hidden dark:block"
            priority
          />
        </>
      ),
      url: "/",
    },
    githubUrl: GITHUB_URL,
    links: [
      { text: "Guide", url: "/guide", active: "nested-url" },
      { text: "Developers", url: "/developers", active: "nested-url" },
      { text: "API Reference", url: "/api", active: "nested-url" },
      { text: "Open the platform", url: PLATFORM_URL, external: true },
    ],
  };
}
