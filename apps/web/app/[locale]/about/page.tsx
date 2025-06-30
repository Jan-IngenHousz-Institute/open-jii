import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";

import { HomeFooter } from "@repo/cms";
import { AboutContent } from "@repo/cms";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  const session = await auth();
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 pb-24 pt-8">
        <AboutContent t={t} />
      </main>
      <HomeFooter t={t} locale={locale} />
    </>
  );
}
