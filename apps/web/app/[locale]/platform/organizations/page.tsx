import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import OrganizationsListContent from "./organizations-list-content";

interface OrganizationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: OrganizationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("organizations.title") };
}

export default function OrganizationsPage() {
  return <OrganizationsListContent />;
}
