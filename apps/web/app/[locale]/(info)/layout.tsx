import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import { draftMode } from "next/headers";
import React from "react";
import { getContentfulClients } from "~/lib/contentful";

import { HomeFooter } from "@repo/cms";
import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import type { FooterFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}

export default async function InfoGroupLayout({ children, params }: LayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const session = await auth();

  // Fetch Contentful footer data (with preview support)
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const footerQuery = await gqlClient.footer({ locale, preview });
  const footerData = footerQuery.footerCollection?.items[0] as FooterFieldsFragment;

  return (
    <>
      <ContentfulPreviewProvider
        locale={locale}
        enableInspectorMode={preview}
        enableLiveUpdates={preview}
        targetOrigin={allowedOriginList}
      >
        <UnifiedNavbar locale={locale} session={session} />
        <div className="mx-auto flex w-full max-w-7xl justify-center">
          <main className="flex min-h-screen w-full flex-col px-4 pb-24 pt-8">{children}</main>
        </div>
        <HomeFooter footerData={footerData} preview={preview} locale={locale} />
      </ContentfulPreviewProvider>
    </>
  );
}
