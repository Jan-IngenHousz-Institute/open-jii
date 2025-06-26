import Footer from "@/components/blog/footer";
import { TranslationsProvider } from "@/components/translations-provider";
import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { draftMode } from "next/headers";
import { env } from "~/env";

import { ContentfulPreviewProvider } from "@repo/cms/contentful";
import { dir } from "@repo/i18n";
import type { Locale } from "@repo/i18n";
import { locales } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

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

export function generateStaticParams(): LayoutProps["params"][] {
  return locales.map((locale) => ({ locale }));
}

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });

const allowedOriginList = ["https://app.contentful.com", "https://app.eu.contentful.com"];

interface LayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function PageLayout({
  children,
  params,
}: LayoutProps & { params: Promise<{ locale: string }> }) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const session = await auth();
  const typedLocale = locale as Locale;
  const { resources } = await initTranslations({
    locale: typedLocale,
  });

  return (
    <html lang={locale} dir={dir(locale)} className="h-full">
      <head>
        <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#5bbad5" />
      </head>

      <body className="flex min-h-screen flex-col">
        <TranslationsProvider locale={locale as Locale} resources={resources}>
          <ContentfulPreviewProvider
            locale={locale}
            enableInspectorMode={preview}
            enableLiveUpdates={preview}
            targetOrigin={allowedOriginList}
          >
            <UnifiedNavbar locale={typedLocale} session={session} />
            <div
              className={`${urbanist.variable} mx-auto flex w-full max-w-7xl flex-1 flex-col font-sans`}
            >
              <main className="flex-1 pt-8">{children}</main>
              <Footer />
            </div>
            <div id="portal" className={`${urbanist.variable} font-sans`} />
          </ContentfulPreviewProvider>
        </TranslationsProvider>
      </body>
    </html>
  );
}
