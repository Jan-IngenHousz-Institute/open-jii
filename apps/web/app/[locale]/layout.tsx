import { TranslationsProvider } from "@/components/translations-provider";
import type { Metadata } from "next";
import { Poppins, Overpass } from "next/font/google";
import type { ReactNode } from "react";

import { SessionProvider } from "@repo/auth/client";
import { dir } from "@repo/i18n";
import type { Locale, Namespace } from "@repo/i18n";
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

const i18nNamespaces: Namespace[] = ["common", "navigation", "experiments", "dashboard"];

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

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const { resources } = await initTranslations({
    locale,
    namespaces: i18nNamespaces,
  });

  return (
    <html lang={locale} dir={dir(locale)} className="h-full">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        className={cn(
          "bg-background font-overpass flex min-h-screen flex-col antialiased",
          poppins.variable,
          overpass.variable,
        )}
      >
        <TranslationsProvider locale={locale} namespaces={i18nNamespaces} resources={resources}>
          <SessionProvider>
            <QueryProvider>{children}</QueryProvider>
          </SessionProvider>
        </TranslationsProvider>
      </body>
    </html>
  );
}
