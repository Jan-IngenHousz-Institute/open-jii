import { SITE_URL } from "@/lib/site-url";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | openJII Docs",
    default: "openJII Docs",
  },
  description:
    "Documentation for the openJII platform: guides for researchers, developer references, and API contracts.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "openJII Docs",
    description: "Open science for photosynthesis research. Measure, analyze, and share your data.",
    siteName: "openJII Docs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "openJII Docs",
    description: "Open science for photosynthesis research. Measure, analyze, and share your data.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
      </body>
    </html>
  );
}
