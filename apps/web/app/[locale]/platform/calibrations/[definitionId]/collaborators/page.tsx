import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import CalibrationCollaboratorsContent from "./calibration-collaborators-content";

interface CalibrationCollaboratorsPageProps {
  params: Promise<{ locale: string; definitionId: string }>;
}

export async function generateMetadata({
  params,
}: CalibrationCollaboratorsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("sharing.collaboratorsTab") };
}

export default function CalibrationCollaboratorsPage({
  params,
}: CalibrationCollaboratorsPageProps) {
  return <CalibrationCollaboratorsContent params={params} />;
}
