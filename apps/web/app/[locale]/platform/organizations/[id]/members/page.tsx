import { buildOrganizationMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import OrganizationMembersContent from "./organization-members-content";

interface OrganizationMembersPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: OrganizationMembersPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildOrganizationMetadata({ locale, id, section: "members" });
  });
}

export default function OrganizationMembersPage({ params }: OrganizationMembersPageProps) {
  return <OrganizationMembersContent params={params} />;
}
