import { DeviceGroupContent } from "@/components/device-groups/device-group-content";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface DeviceGroupPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: DeviceGroupPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.groups.pageTitle") };
}

export default function DeviceGroupPage() {
  return <DeviceGroupContent />;
}
