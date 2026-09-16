import { CalibrationDefinitionDetail } from "@/components/calibrations/calibration-definition-detail";
import { PageContainer } from "@/components/page-container";
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
  return (
    <PageContainer width="reading" className="space-y-6">
      <CalibrationDefinitionDetail />
    </PageContainer>
  );
}
