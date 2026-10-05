import { CalibrationGate } from "@/components/calibrations/calibration-gate";
import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const CALIBRATION_NAMESPACES: Namespace[] = ["iot", "experiments"];

interface CalibrationsLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CalibrationsLayout({ children, params }: CalibrationsLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, CALIBRATION_NAMESPACES);

  return (
    <TranslationBundles resources={bundles}>
      <CalibrationGate>{children}</CalibrationGate>
    </TranslationBundles>
  );
}
