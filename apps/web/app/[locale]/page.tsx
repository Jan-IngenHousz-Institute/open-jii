import { UnifiedNavbar } from "@/components/unified-navbar";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <UnifiedNavbar locale={locale} />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-jii-dark-green mb-6 text-4xl font-bold">{t("jii.institute")}</h1>

        <p className="mb-8 text-lg">{t("jii.aboutDescription")}</p>

        <div className="bg-jii-light-blue/30 mt-8 rounded-lg p-6">
          <h2 className="text-jii-dark-green mb-4 text-2xl font-semibold">{t("jii.mission")}</h2>
          <p>{t("jii.missionDescription")}</p>
        </div>
      </div>
    </>
  );
}
