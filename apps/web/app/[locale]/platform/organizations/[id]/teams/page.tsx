import { buildOrganizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import OrganizationTeamsContent from "./organization-teams-content";

interface OrganizationTeamsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: OrganizationTeamsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildOrganizationMetadata({ locale, id, section: "teams" });
  });
}

export default function OrganizationTeamsPage({ params }: OrganizationTeamsPageProps) {
  return <OrganizationTeamsContent params={params} />;
}
