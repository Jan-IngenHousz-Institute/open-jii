import { CalibrationRunContent } from "@/components/calibrations/calibration-run-content";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface CalibrationRunPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CalibrationRunPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.calibration.trial.title") };
}

export default function CalibrationRunPage() {
  return <CalibrationRunContent />;
}
