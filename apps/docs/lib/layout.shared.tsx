import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const GITHUB_OWNER = "Jan-IngenHousz-Institute";
export const GITHUB_REPO = "open-jii";
export const GITHUB_BRANCH = "main";
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const PLATFORM_URL = "https://openjii.org";

// Docs MDX lives here relative to repo root; used for "Edit on GitHub" links.
export const DOCS_CONTENT_ROOT = "apps/docs/content";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src="/img/openjii-logo-horizontal.svg"
            alt="openJII"
            width={85}
            height={40}
            className="block dark:hidden"
            priority
          />
          <Image
            src="/img/openjii-logo-horizontal-dark.svg"
            alt="openJII"
            width={138}
            height={40}
            className="hidden dark:block"
            priority
          />
          <span className="text-fd-muted-foreground text-sm font-medium">Docs</span>
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
