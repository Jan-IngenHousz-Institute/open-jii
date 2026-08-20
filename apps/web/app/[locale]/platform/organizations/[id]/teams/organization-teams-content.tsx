"use client";

import { OrganizationTeamsSurface } from "@/components/organizations/organization-teams-surface";
import { use } from "react";

interface OrganizationTeamsPageProps {
  params: Promise<{ id: string }>;
}

/** Teams route; the layout's profile query supplies the caller's role. */
export default function OrganizationTeamsPage({ params }: OrganizationTeamsPageProps) {
  const { id } = use(params);

  return <OrganizationTeamsSurface organizationId={id} />;
}
