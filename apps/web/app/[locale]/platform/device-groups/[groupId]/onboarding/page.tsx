import { GroupComingSoon } from "@/components/device-groups/group-coming-soon";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.groups.pageTitle") };
}

export default function DeviceGroupOnboardingPage() {
  return <GroupComingSoon section="onboarding" />;
}
