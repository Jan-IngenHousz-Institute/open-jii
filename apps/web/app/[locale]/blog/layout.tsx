import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { draftMode } from "next/headers";
import { env } from "~/env";
import { getContentfulClients } from "~/lib/contentful";

import { HomeFooter } from "@repo/cms";
import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import type { FooterFieldsFragment } from "@repo/cms/lib/__generated/sdk";
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

  // Fetch footer data for HomeFooter
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const footerQuery = await gqlClient.footer({ locale, preview });
  const footerData = footerQuery.footerCollection?.items[0] as FooterFieldsFragment;

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
      </div>
      <HomeFooter locale={locale} footerData={footerData} preview={preview} />

      <div id="portal" className={`${urbanist.variable} font-sans`} />
    </ContentfulPreviewProvider>
  );
}
