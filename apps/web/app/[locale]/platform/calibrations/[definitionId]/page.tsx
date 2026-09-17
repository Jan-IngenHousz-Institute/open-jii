import { CalibrationDefinitionDetail } from "@/components/calibrations/calibration-definition-detail";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface CalibrationDefinitionPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CalibrationDefinitionPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.calibration.library.title") };
}

export default function CalibrationDefinitionPage() {
  // The layout already provides the page container; a second one here would narrow the
  // sidebar and the editors to a reading column.
  return <CalibrationDefinitionDetail />;
}
