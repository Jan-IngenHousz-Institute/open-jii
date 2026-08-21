import { newOrganizationPath } from "@/components/organizations/organization-routes";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        title={t("organizations.title")}
        description={t("organizations.listDescription")}
        actions={
          <Button asChild>
            <Link href={newOrganizationPath(locale)}>{t("organizations.createAction")}</Link>
          </Button>
        }
      />
      <OrganizationsListContent />
    </>
  );
}
