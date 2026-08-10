"use client";

import { ComingSoonPanel } from "@/components/iot-devices/coming-soon-panel";

import { useTranslation } from "@repo/i18n";

/**
 * Placeholder tab. A route rather than an in-page panel so the strip behaves the
 * same way whichever tab is clicked — and so this becomes a real page by filling
 * it in, not by rewiring the strip.
 */
export default function DeviceLineagePage() {
  const { t } = useTranslation("iot");

  return <ComingSoonPanel description={t("iot.devices.comingSoon.lineage")} />;
}
