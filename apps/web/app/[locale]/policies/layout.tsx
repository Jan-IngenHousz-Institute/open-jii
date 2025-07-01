import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import { draftMode } from "next/headers";
import React from "react";

import { HomeFooter } from "@repo/cms";
import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}

export default async function PoliciesLayout({ children, params }: LayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const session = await auth();
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <ContentfulPreviewProvider
        locale={locale}
        enableInspectorMode={preview}
        enableLiveUpdates={preview}
        targetOrigin={allowedOriginList}
      >
        <UnifiedNavbar locale={locale} session={session} />
        <div className={`mx-auto flex w-full max-w-7xl flex-1 flex-col`}>
          <main className="flex-1 pt-8">{children}</main>
        </div>
        <HomeFooter t={t} locale={locale} />
      </ContentfulPreviewProvider>
    </>
  );
}
