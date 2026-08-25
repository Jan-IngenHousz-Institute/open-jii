import { DevicesOverviewContent } from "@/components/iot-devices/devices-overview-content";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface DevicesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: DevicesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.devices.title") };
}

export default function DevicesPage() {
  return <DevicesOverviewContent />;
}
