import type { Metadata } from "next";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "openJII",
};

interface PlatformPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function OpenJIIHome({ params }: PlatformPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <h1 className="text-jii-dark-green mb-6 text-4xl font-bold">
        {t("jii.institute")}
      </h1>
      <div className="flex items-center gap-2 py-12">
        <Button>{t("common.noVariant")}</Button>
      </div>
      <p className="mb-4 text-lg">{t("jii.aboutDescription")}</p>
      <div className="bg-jii-light-blue/30 mt-8 h-64 rounded-lg p-6">
        <h2 className="text-jii-dark-green mb-4 text-2xl font-semibold">
          {t("jii.mission")}
        </h2>
        <p>{t("jii.missionDescription")}</p>
      </div>
    </>
  );
}
