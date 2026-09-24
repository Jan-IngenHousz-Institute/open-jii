import { TranslationsProvider } from "@/components/translations-provider";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import React from "react";
import type { ReactNode } from "react";
import { isFeatureFlagEnabledForViewer } from "~/lib/posthog-server";

import { FEATURE_FLAGS } from "@repo/analytics";
import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import { defaultLocale, isKnownLocale, namespaces } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { AlertsBar } from "../../components/alerts-bar";
import { PostHogIdentifier } from "../../hooks/usePostHogAuth";
import { QueryProvider } from "../../providers/QueryProvider";
import "../globals.css";

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

  const { isEnabled: preview } = await draftMode();

  // Only another locale needs the flag, so default-locale pages skip the session lookup.
  const isOtherLocale = locale !== defaultLocale;
  if (isOtherLocale && !(await isFeatureFlagEnabledForViewer(FEATURE_FLAGS.MULTI_LANGUAGE))) {
    notFound();
  }

  const { resources } = await initTranslations({
    locale,
    namespaces: [...namespaces],
  });

  return (
    <div className="bg-background flex h-full min-h-screen flex-col antialiased">
      <ContentfulPreviewProvider
        locale={locale}
        enableInspectorMode={preview}
        enableLiveUpdates={preview}
        targetOrigin={allowedOriginList}
      >
        <TranslationsProvider locale={locale} namespaces={[...namespaces]} resources={resources}>
          <AlertsBar locale={locale} preview={preview} />
          <QueryProvider>
            <PostHogIdentifier />
            {children}
          </QueryProvider>
        </TranslationsProvider>
      </ContentfulPreviewProvider>
    </div>
  );
}
