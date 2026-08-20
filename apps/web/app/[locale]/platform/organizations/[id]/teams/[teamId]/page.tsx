import { buildOrganizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import OrganizationTeamContent from "./organization-team-content";

interface OrganizationTeamPageProps {
  params: Promise<{ locale: string; id: string; teamId: string }>;
}

export function generateMetadata({ params }: OrganizationTeamPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id, teamId } = await params;
    return buildOrganizationMetadata({ locale, id, section: "teams", teamId });
  });
}

export default function OrganizationTeamPage({ params }: OrganizationTeamPageProps) {
  return <OrganizationTeamContent params={params} />;
}
