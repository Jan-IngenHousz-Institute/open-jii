import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { env } from "~/env";
import { QueryProvider } from "~/providers/query-provider";
import { TranslationsProvider } from "~/providers/translations-provider";

import { defaultLocale } from "@repo/i18n/config";
import type { Namespace } from "@repo/i18n/config";
import initTranslations, { loadNamespaceBundles } from "@repo/i18n/server";
import { ThemeProvider } from "@repo/ui/components/theme";

import "./globals.css";

// The font variable has to sit on <html> so the `--font-sans` declaration in theme.css `:root`
// can resolve it.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

const PAGE_NAMESPACES: Namespace[] = ["status"];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await initTranslations({ locale: defaultLocale, namespaces: PAGE_NAMESPACES });
  const isIndexable = env.STATUS_INDEXABLE === "true";

  return {
    metadataBase: env.STATUS_BASE_URL === undefined ? undefined : new URL(env.STATUS_BASE_URL),
    title: t("metadata.title"),
    description: t("metadata.description"),
    robots: { index: isIndexable, follow: isIndexable },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const resources = await loadNamespaceBundles(defaultLocale, PAGE_NAMESPACES);

  return (
    <html lang={defaultLocale} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen antialiased">
        {/* The swap is instant rather than a cross-fade: `transition-colors` is on most primitives. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TranslationsProvider
              locale={defaultLocale}
              namespaces={PAGE_NAMESPACES}
              resources={resources}
            >
              {children}
            </TranslationsProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
