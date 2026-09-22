import { CalibrationBench } from "@/components/iot-devices/calibration/bench/calibration-bench";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface CalibrationBenchPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CalibrationBenchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.calibration.bench.title") };
}

export default function CalibrationBenchPage() {
  return (
    <PageContainer width="fluid" className="space-y-6">
      <CalibrationBench />
    </PageContainer>
  );
}
