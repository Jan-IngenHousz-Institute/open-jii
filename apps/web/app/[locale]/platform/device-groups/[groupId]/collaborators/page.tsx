import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import GroupCollaboratorsContent from "./group-collaborators-content";

interface PageProps {
  params: Promise<{ locale: string; groupId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.groups.pageTitle") };
}

export default function GroupCollaboratorsPage({ params }: PageProps) {
  return <GroupCollaboratorsContent params={params} />;
}
