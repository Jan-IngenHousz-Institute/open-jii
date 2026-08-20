import { buildOrganizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import OrganizationOverviewContent from "./organization-overview-content";

interface OrganizationOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: OrganizationOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildOrganizationMetadata({ locale, id });
  });
}

export default function OrganizationOverviewPage({ params }: OrganizationOverviewPageProps) {
  return <OrganizationOverviewContent params={params} />;
}
