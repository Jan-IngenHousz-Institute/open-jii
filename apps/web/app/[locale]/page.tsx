import { LanguageSwitcher } from "@/components/language-switcher";
import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

import { AuthShowcase } from "../_components/auth-showcase";

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
      {/* Language switcher in top right */}
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher locale={locale} />
      </div>

      <AuthShowcase t={t} />

      <h1 className="text-jii-dark-green mb-6 text-4xl font-bold">
        {t("jii.institute")}
      </h1>
      <div className="flex items-center gap-2 py-12">
        <Button>{t("common.noVariant")}</Button>
        <Button variant={"destructive"}>{t("common.destructive")}</Button>
        <Button variant={"ghost"}>{t("common.ghost")}</Button>
        <Button variant={"link"}>{t("common.link")}</Button>
        <Button variant={"secondary"}>{t("common.secondary")}</Button>
        <Button variant={"outline"}>{t("common.outline")}</Button>
      </div>
      <p className="mb-4 text-lg">{t("jii.aboutDescription")}</p>
      <div className="bg-jii-light-blue/30 mt-8 h-64 rounded-lg p-6">
        <h2 className="text-jii-dark-green mb-4 text-2xl font-semibold">
          {t("jii.mission")}
        </h2>
        <p>{t("jii.missionDescription")}</p>
      </div>
      <div className="p-6">
        <Link href={`/${locale}/openjii`}>
          <Button>{t("jii.goToPlatform")}</Button>
        </Link>
      </div>
    </>
  );
}
