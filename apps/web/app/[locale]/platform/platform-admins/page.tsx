import { PlatformAdmins } from "@/components/platform-admins/platform-admins";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  return { title: t("platformAdmins.title") };
}

export default function PlatformAdminsPage() {
  return <PlatformAdmins />;
}
