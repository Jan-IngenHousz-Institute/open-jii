import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image src="/img/logo.png" alt="openJII" width={24} height={24} className="rounded" />
          openJII Docs
        </>
      ),
      url: "/",
    },
    links: [
      { text: "Guide", url: "/guide", active: "nested-url" },
      { text: "Developers", url: "/developers", active: "nested-url" },
      { text: "API Reference", url: "/api", active: "nested-url" },
    ],
  };
}
