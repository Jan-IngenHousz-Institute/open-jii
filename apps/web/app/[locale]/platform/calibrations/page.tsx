import { ListCalibrationDefinitions } from "@/components/calibrations/list-calibration-definitions";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { calibrationDefinitionsQuery } from "@/hooks/iot/useAllCalibrationDefinitions/calibration-definitions-query";
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
      <PrefetchedQueries queries={(utils) => [calibrationDefinitionsQuery(utils)]}>
        <ListCalibrationDefinitions />
      </PrefetchedQueries>
    </PageContainer>
  );
}
