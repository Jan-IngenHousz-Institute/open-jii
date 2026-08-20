"use client";

import { OrganizationTeamDetail } from "@/components/organizations/organization-team-detail";
import { use } from "react";

interface OrganizationTeamPageProps {
  params: Promise<{ id: string; teamId: string }>;
}

/** One team's roster; the layout's profile query supplies the caller's role. */
export default function OrganizationTeamPage({ params }: OrganizationTeamPageProps) {
  const { id, teamId } = use(params);

  return <OrganizationTeamDetail organizationId={id} teamId={teamId} />;
}
