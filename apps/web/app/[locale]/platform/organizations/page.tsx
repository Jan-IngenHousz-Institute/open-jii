import { newOrganizationPath } from "@/components/organizations/organization-routes";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

import OrganizationsListContent from "./organizations-list-content";

interface OrganizationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: OrganizationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("organizations.title") };
}

export default async function OrganizationsPage({ params }: OrganizationsPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("organizations.title")}</h1>
          <p>{t("organizations.listDescription")}</p>
        </div>
        <Button asChild>
          <Link href={newOrganizationPath(locale)}>{t("organizations.createAction")}</Link>
        </Button>
      </div>
      <OrganizationsListContent />
    </>
  );
}
