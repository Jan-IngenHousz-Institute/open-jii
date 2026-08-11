import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import NewOrganizationContent from "./new-organization-content";

interface NewOrganizationPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewOrganizationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("organizations.createAction") };
}

export default async function NewOrganizationPage({ params }: NewOrganizationPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return (
    <>
      <div>
        <h1 className="text-4xl font-bold text-gray-900">{t("organizations.createAction")}</h1>
        <p>{t("organizations.listDescription")}</p>
      </div>
      <NewOrganizationContent />
    </>
  );
}
