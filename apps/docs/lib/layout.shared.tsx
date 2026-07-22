import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const GITHUB_URL = "https://github.com/Jan-IngenHousz-Institute/open-jii";
export const PLATFORM_URL = "https://openjii.org";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src="/img/openjii-logo-horizontal.png"
            alt="openJII"
            width={109}
            height={32}
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
