import { buildOrganizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import OrganizationSettingsContent from "./organization-settings-content";

interface OrganizationSettingsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: OrganizationSettingsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildOrganizationMetadata({ locale, id, section: "settings" });
  });
}

export default function OrganizationSettingsPage({ params }: OrganizationSettingsPageProps) {
  return <OrganizationSettingsContent params={params} />;
}
