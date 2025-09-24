import { TranslationsProvider } from "@/components/translations-provider";
import type { Metadata } from "next";
import { Poppins, Overpass } from "next/font/google";
import { draftMode } from "next/headers";
import React from "react";
import type { ReactNode } from "react";

import { SessionProvider } from "@repo/auth/client";
import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import type { Locale } from "@repo/i18n";
import { namespaces } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { cn } from "@repo/ui/lib/utils";

import { QueryProvider } from "../../providers/QueryProvider";
import "../globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
});

const overpass = Overpass({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-overpass",
});

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return {
    title: t("jii.institute"),
    description: t("jii.aboutDescription"),
  };
}

const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const { resources } = await initTranslations({
    locale,
    namespaces: [...namespaces],
  });

  return (
    <div
      className={cn(
        "bg-background font-overpass flex h-full min-h-screen flex-col antialiased",
        poppins.variable,
        overpass.variable,
      )}
    >
      <ContentfulPreviewProvider
        locale={locale}
        enableInspectorMode={preview}
        enableLiveUpdates={preview}
        targetOrigin={allowedOriginList}
      >
        <TranslationsProvider locale={locale} namespaces={[...namespaces]} resources={resources}>
          <SessionProvider>
            <QueryProvider>{children}</QueryProvider>
          </SessionProvider>
        </TranslationsProvider>
      </ContentfulPreviewProvider>
    </div>
  );
}
