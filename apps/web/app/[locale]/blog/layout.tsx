import Footer from "@/components/blog/footer";
import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { draftMode } from "next/headers";
import { env } from "~/env";

import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import type { Locale } from "@repo/i18n";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_BASE_URL),
    twitter: {
      card: "summary_large_image",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });
const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}

export default async function PageLayout({ children, params }: LayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const session = await auth();

  return (
    <ContentfulPreviewProvider
      locale={locale}
      enableInspectorMode={preview}
      enableLiveUpdates={preview}
      targetOrigin={allowedOriginList}
    >
      <UnifiedNavbar locale={locale} session={session} />
      <div
        className={`${urbanist.variable} mx-auto flex w-full max-w-7xl flex-1 flex-col font-sans`}
      >
        <main className="flex-1 pt-8">{children}</main>
        <Footer />
      </div>
      <div id="portal" className={`${urbanist.variable} font-sans`} />
    </ContentfulPreviewProvider>
  );
}
