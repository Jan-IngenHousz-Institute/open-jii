import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";

import { HomeFooter, FaqContent } from "@repo/cms";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface FaqPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  const session = await auth();
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-4xl px-4">
          <FaqContent t={t} />
        </div>
      </main>
      <HomeFooter t={t} locale={locale} />
    </>
  );
}
