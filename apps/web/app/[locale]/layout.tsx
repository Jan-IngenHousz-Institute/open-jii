import { ContentfulLivePreview } from "@/components/contentful-live-preview";
import { TranslationsProvider } from "@/components/translations-provider";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import React from "react";
import type { ReactNode } from "react";

import { isKnownLocale } from "@repo/i18n";
import type { Namespace } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { AlertsBar } from "../../components/alerts-bar";
import { PostHogIdentifier } from "../../hooks/usePostHogAuth";
import { QueryProvider } from "../../providers/QueryProvider";
import "../globals.css";

// What every page shows, including the cookie banner outside any provider. Route
// segments add the rest through `TranslationBundles`.
const PAGE_NAMESPACES: Namespace[] = ["common"];

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isKnownLocale(locale)) {
    notFound();
  }

  // Who may see another locale is decided per viewer in proxy.ts, before this renders, so the
  // layout reads nothing from the request and the pages under it can be cached.
  const { isEnabled: preview } = await draftMode();

  const { resources } = await initTranslations({ locale, namespaces: PAGE_NAMESPACES });

  const page = (
    <TranslationsProvider locale={locale} namespaces={PAGE_NAMESPACES} resources={resources}>
      <AlertsBar locale={locale} preview={preview} />
      <QueryProvider>
        <PostHogIdentifier />
        {children}
      </QueryProvider>
    </TranslationsProvider>
  );

  // Outside preview the CMS hooks find no provider and stay inert, as they did with it disabled.
  return (
    <div className="bg-background flex h-full min-h-screen flex-col antialiased">
      {preview ? (
        <ContentfulLivePreview
          locale={locale}
          enableInspectorMode
          enableLiveUpdates
          targetOrigin={allowedOriginList}
        >
          {page}
        </ContentfulLivePreview>
      ) : (
        page
      )}
    </div>
  );
}
