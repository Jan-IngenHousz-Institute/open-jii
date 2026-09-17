import { ListCalibrationDefinitions } from "@/components/calibrations/list-calibration-definitions";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface CalibrationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CalibrationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.calibration.library.title") };
}

export default function CalibrationsPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <ListCalibrationDefinitions />
    </PageContainer>
  );
}
